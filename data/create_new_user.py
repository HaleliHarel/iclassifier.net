import sqlite3
import re
import hashlib
import binascii


def get_user_tag(user_metadata, current_user_ids):
    print('Input the user tag (a single lower-case word, no whitespaces):', end=' ')
    while True:
        candidate_tag = input()
        if not re.fullmatch(r'[a-z]+', candidate_tag):
            print(f'A malformed user tag: "{candidate_tag}"; '
                   'please provide another tag:', end=' ')
            continue
        elif candidate_tag in current_user_ids:
            print(f'The user tag "{candidate_tag}" is already in use; '
                   'please provide another tag:', end=' ')
            continue
        user_metadata['username'] = candidate_tag
        break


def get_user_name(user_metadata):
    print("Input the user's name:", end=' ')
    user_metadata['name'] = input()


def get_user_email(user_metadata):
    print("Input the user's email (note: no email validation will take place):", end=' ')
    user_metadata['email'] = input()


def add_user(user_info, auth_conn):
    cursor = auth_conn.cursor()
    cursor.execute(
        '''
        INSERT INTO participants (username, name, email)
        VALUES (?, ?, ?)''',
        (user_info['username'], user_info['name'], user_info['email']))
    return cursor.lastrowid


def hashpass(password):
    with open('auth/salt', 'rb') as inp:
        salt = inp.read()
    dk = hashlib.pbkdf2_hmac('sha256',
                             bytes(password, 'ascii'),
                             salt,
                             10**5)
    result = binascii.hexlify(dk)
    return result


def get_user_password():
    print("Input the user's password (no whitespaces):", end=' ')
    while True:
        candidate_passwd = input()
        if not re.fullmatch(r'[\S]+', candidate_passwd):
            print(f'A malformed password: "{candidate_passwd}"; '
                   'please provide another password:', end=' ')
            continue
        return candidate_passwd


def set_password(user_id, passwd_hash, auth_conn):
    cursor = auth_conn.cursor()
    cursor.execute(
        '''
        INSERT INTO passwd (hash, user_id)
        VALUES (?, ?)''',
        (passwd_hash, user_id))


def main():
    auth_conn = sqlite3.connect('auth/auth.sqlite')
    cursor = auth_conn.cursor()

    current_user_ids = set(el[0] for el in cursor.execute(
        'SELECT username FROM participants'))
    
    while True:
        user_metadata = {}
        get_user_tag(user_metadata, current_user_ids)
        get_user_name(user_metadata)
        get_user_email(user_metadata)

        print('Creating a user with the following details:')
        for k, v in user_metadata.items():
            print(f'\t{k}: {v}')
        print('Press Enter to continue or type n or N to try again.')
        test = input()
        if not test.strip():
            break
    new_user_id = add_user(user_metadata, auth_conn)

    # Create the user's password.
    user_password = get_user_password()
    password_hash = hashpass(user_password).decode('ascii')
    set_password(new_user_id, password_hash, auth_conn)
    
    auth_conn.commit()
    print(f'A new user created with the following id: {new_user_id}')


if __name__ == '__main__':
    main()

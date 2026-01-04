import sqlite3
import hashlib
import binascii
from enum import Enum


class AuthStatus(Enum):
    SUCCESS = 1
    NO_USER = 2
    INCORRECT_PASSWORD = 3


dbconn = sqlite3.connect('../data/auth/auth.sqlite')
cursor = dbconn.cursor()


def authenticate_user(username, password):
    cursor.execute('SELECT id FROM participants WHERE username=?', (username,))
    user_id = cursor.fetchone()
    if user_id is None:
        return AuthStatus.NO_USER, None
    user_id = user_id[0]
    cursor.execute('SELECT hash FROM passwd WHERE `user_id`=?', (user_id,))
    password_hash = cursor.fetchone()
    if not password_hash:
        raise ValueError(f'No password hash found for user "{username}".')
    test_password_hash = hashpass(password)
    if bytes(password_hash[0], 'ascii') == test_password_hash:
        return AuthStatus.SUCCESS, user_id
    else:
        return AuthStatus.INCORRECT_PASSWORD, None


def hashpass(password):
    with open('../data/auth/salt', 'rb') as inp:
        salt = inp.read()
    dk = hashlib.pbkdf2_hmac('sha256',
                             bytes(password, 'ascii'),
                             salt,
                             10**5)
    result = binascii.hexlify(dk)
    return result


def get_project_info(project_tag):
    cursor.execute(
        'SELECT * FROM project_info WHERE `project_id`=?', 
        (project_tag,))
    data_tuple = cursor.fetchone()
    colnames = [d[0] for d in cursor.description]
    return dict(zip(colnames, data_tuple))


def is_admin_user(username):
    """Check if a user is an admin."""
    admin_users = ['haleliharel', 'orlygoldwasser', 'dmitrynikolaev']
    return username in admin_users


def check_user_access(user_id, project_tag):
    # TODO: convert to proper SQL code later
    project_id = None
    for project_id_, project_tag_ in cursor.execute(
            "SELECT id, `project_id` FROM `project_info`"
        ):
        if project_tag_ == project_tag:
            project_id = project_id_
            break
    else:
        print(f'Could not find the id for the project {project_tag}')
        return None

    for permission, project_id_, user_id_ in cursor.execute(
            'SELECT type, `project_id`, `user_id` FROM permissions'
        ):
        if project_id_ == project_id and str(user_id_) == user_id:
            return permission
    else:
        print(f'Could not find permission for {user_id=}, {project_id=}, and {project_tag=}')
        return None


import os
import sqlite3
import re
import json


def get_participants(auth_conn):
    cursor = auth_conn.cursor()
    return [{
        'id': pid,
        'name': pname
    } for pid, pname in cursor.execute('SELECT id, name FROM participants')]


def format_participants(participant_array):
    format_person = lambda d: f'{d["name"]} ({d["id"]})'
    return ', '.join(map(
        format_person,
        sorted(participant_array, key=lambda p: p['name'])
    ))


def get_project_tag(project_metadata, current_project_ids):
    print('Input the project tag (a single lower-case word, no whitespaces):', end=' ')
    while True:
        candidate_tag = input()
        if not re.fullmatch(r'[a-z]+', candidate_tag):
            print(f'A malformed project tag: "{candidate_tag}"; '
                   'please provide another tag:', end=' ')
            continue
        elif candidate_tag in current_project_ids:
            print(f'The project tag "{candidate_tag}" is already in use; '
                   'please provide another tag:', end=' ')
            continue
        project_metadata['project_id'] = candidate_tag
        break


def get_project_name(project_metadata):
    print('Input the project name:', end=' ')
    project_metadata['title'] = input()


def get_project_type(project_metadata, project_types):
    all_types = set(project_types)
    print('Select the project type:')
    for k, v in sorted(project_types.items()):
        print(f'\t{k}: {v}')
    while True:
        try:
            try:
                candidate_type = int(input())
            except ValueError:
                print('You must type in one of the numbers above:', end=' ')
                continue
            if candidate_type not in all_types:
                raise IndexError(f'The selected type "{candidate_type}" is not available.')
        except IndexError as ie:
            print(ie)
            print('Select another type:', end=' ')
            continue
        project_metadata['project_type'] = project_types[candidate_type]
        break


def validate_participant_ids(id_string, all_pids):
    for id_s in id_string.strip().split():
        try:
            id_int = int(id_s)
            if id_int not in all_pids:
                raise IndexError(f'A missing participant: {id_int}; try again.')
        except ValueError:
            raise ValueError(f'An invalid id: "{id_s}"; try again.')


def get_pids(all_pids):
    while True:
        participant_id_string = input()
        try:
            validate_participant_ids(participant_id_string, all_pids)
            return map(int, participant_id_string.strip().split())
        except (ValueError, IndexError) as e:
            print(f'Validation error: {e}')
            continue


def get_project_permissions(project_metadata, auth_conn):
    project_metadata['read'] = []
    project_metadata['write'] = []

    participants = get_participants(auth_conn)
    all_pids = set(p['id'] for p in participants)
 
    print('Type in whitespace-separated ids of users that should have READ access to the'
          ' project (can be empty if the same people will also have write access):')
    print()
    print(format_participants(participants))
    print()
    for pid in get_pids(all_pids):
        project_metadata['read'].append(pid)

    print('Type in whitespace-separated ids of users that should have WRITE access'
          ' to the project:')
    print()
    print(format_participants(participants))
    print()
    for pid in get_pids(all_pids):
        project_metadata['write'].append(pid)


def set_project_metadata(project_metadata, auth_conn):
    cursor = auth_conn.cursor()
    # 1. Add the new project to project_info
    cursor.execute(
        '''
        INSERT INTO `project_info` 
            (`project_id`, title, `open_for_browsing`)
        VALUES (?, ?, ?)''',
        # Reports are now only open to project owners, so we change the default
        # openness setting to 1.
        (project_metadata['project_id'], project_metadata['title'], 1))
    project_id = cursor.lastrowid
    # 2. Add the project type to project_type
    cursor.execute(
        '''
        INSERT INTO `project_type` (`project_id`, `project_type`)
        VALUES (?, ?)''',
        (project_id, project_metadata['project_type']))
    # 3. Set permissions in permissions
    for action in ['read', 'write']:
        for user_id in set(project_metadata[action]):
            cursor.execute(
                '''
                INSERT INTO permissions (`user_id`, `project_id`, type)
                VALUES (?, ?, ?)
                ''',
                (user_id, project_id, action)) 
    auth_conn.commit()

    with open('project_types.json', 'r', encoding='utf8') as inp:
        project_type_dict = json.load(inp)
    project_type_dict[
        project_metadata['project_id']] = project_metadata['project_types']
    with open('project_types.json', 'w', encoding='utf8') as out:
        json.dump(project_type_dict, out, indent=2)
        

def create_empty_project(project_tag):
    project_dir_path = os.path.join('projects', project_tag)
    project_file_path = os.path.join(project_dir_path, 'clf.db')
    assert not os.path.exists(project_file_path), 'The project file already exists!'
    if not os.path.exists(project_dir_path):
        os.mkdir(project_dir_path)

    init_script_path = os.path.join('projects', 'create_empty_project.sql')
    with open(init_script_path, 'r') as inp:
        sql_script = inp.read()
    conn = sqlite3.connect(project_file_path)
    cursor = conn.cursor()
    cursor.executescript(sql_script)
    conn.commit()
    conn.close()


def main():
    auth_conn = sqlite3.connect('auth/auth.sqlite')
    cursor = auth_conn.cursor()
    current_project_ids = set(el[0] for el in cursor.execute(
        'SELECT `project_id` FROM `project_info`'))
    project_types = {
        1: 'default',
        2: 'hieroglyphic',
        3: 'cuneiform',
        4: 'chinese'
    }

    project_metadata = {}
    get_project_tag(project_metadata, current_project_ids)
    get_project_name(project_metadata)
    get_project_type(project_metadata, project_types)
    get_project_permissions(project_metadata, auth_conn)
    print(project_metadata)

    create_empty_project(project_metadata['project_id'])
    set_project_metadata(project_metadata, auth_conn)
    

if __name__ == '__main__':
    main()
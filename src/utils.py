import json


ORIGIN = 'iclassifier.click'
# Possible actions
GET_ACTIONS = [
    'all',
    'ids',
    'byid',
    'byforeignid',
    'bycolumnvalue',
    'bycolumnname',
    'allclfs',
    'clfreport',
    'getxlsx',
    'getadmincomment'
]
POST_ACTIONS = [
    'add',
    # An add where all the data about the item are sent at once.
    'holisticadd',
    'holisticdelete',
    'addmultiple',
    'deletebyid',
    'deletebyidmultiple',
    'deletebyforeignkey',
    'addbyforeignkey',
    'replacebyforeignkey',
    'updaterecord',
    'updateclfparses',
    'clearcompoundids',
    'setcompoundids',
    'addtokenstowitness',
    'addtokenstowitnesstransliteration',
    'addclfannotations',
    'updateadmincomment'
]


with open('../data/project_types.json') as f:
    project_types = json.load(f)
with open('../data/biblio_id_mapping.json', 'r', encoding='utf-8') as inp:
    biblio_id_mapping = json.load(inp)


def get_access_level(user_id, project_id, cursor):
    access_level = None
    # First check for blanket access.
    # Blanket access for reading can be overriden
    # with write access to a particular project.
    # Project IDs are considered to be stable.
    # The project 'everything' providing blanket access
    # has ID = 5.
    # Blanket write access should not be overriden by
    # read access to a particular project, but this
    # collision should be avoided.
    for access_type_tuple in cursor.execute(
        """
        SELECT `type` FROM `permissions`
        WHERE `user_id` = ?
        AND `project_id` = 5
        """,
        (user_id,)
    ):
        access_level = access_type_tuple[0]
        break
    if access_level == 'write':
        return access_level
    for access_type_tuple in cursor.execute(
        """
        SELECT `type` FROM `permissions`
        WHERE `user_id` = ?
        AND `project_id` = ?
        """,
        (user_id, project_id)
    ):
        access_level = access_type_tuple[0]
    return access_level


def get_projects_for_user(user_id, connection):
    result = []
    cursor = connection.cursor()

    # Check for access to all projects separately,
    # so that we don't have to think about conflicts between 
    # blanket/particular permissions.

    for num in cursor.execute('SELECT COUNT(*) FROM `project_info`'):
        print(num)
        break

    for (
        project_id,
        project_tag,
        project_title,
        _
    ) in cursor.execute(
        'SELECT * FROM `project_info`'
    ):
        # We will check for 'everything' in get_access_level.
        # print(project_tag, end='... ')
        if project_tag == 'everything':
            print('skipping')
            continue
        access_level = get_access_level(user_id, project_id, connection)
        # print(access_level)
        if access_level is not None:
            result.append(
                {'value': project_tag, 'label': project_title}
            )
    return result


def populate_headers_basic(resp):
    """Restricts access to iclassifier.pw; allows cookies.
    Should not be used in the code itself, consider using one of
    populate_headers_TYPE functions."""
    resp.headers['Access-Control-Allow-Origin'] = ORIGIN
    resp.headers['Access-Control-Allow-Credentials'] = 'true'


def populate_headers_json(resp):
    resp.headers['Content-Type'] = 'application/json'
    populate_headers_basic(resp)


def populate_headers_plain(resp):
    resp.headers['Content-Type'] = 'text/plain'
    populate_headers_basic(resp)


def check_objects_table(connection, cursor, table_name):
    table_names = cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table';")
    table_names = [el[0] for el in table_names if el[0] != 'sqlite_sequence']
    if table_name not in table_names:
        if table_name == 'objects':
            cursor.execute("""CREATE TABLE objects (
                `id` integer primary key autoincrement,
                `name` text,
                `period_date_start` text,
                `period_date_end` text,
                `chrono_date_start` text,
                `chrono_date_end` text,
                `comments` text,
                `location` text,
                `tla_data` text -- json-encoded information from TLA; by default read only
            )""")
        elif table_name == 'witness_tla_info':
            cursor.execute("""CREATE TABLE witness_tla_info (
                `id` integer primary key autoincrement,
                `witness_id` integer references `witnesses`(`id`),
                `object_id` integer references `objects`(`id`),
                `tla_data` text -- json-encoded information from TLA; by default read only
            )""")
    connection.commit()

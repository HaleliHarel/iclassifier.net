from functools import wraps
import sqlite3
import json
import flask
from flask_login import *
import jwt

import forms
import users
import authentication
import utils
import config

import TableProcessing as TP
import RequestHandlers as RH
import Analysis


app = flask.Flask(__name__)
with open('../data/auth/secretkey', 'r', encoding='utf-8') as inp:
    app.secret_key = bytes(inp.read().strip(), encoding='utf-8')
with open('../data/auth/jwtsecretkey', 'r', encoding='utf-8') as inp:
    jwt_secret_key = inp.read()

login_manager = LoginManager()
login_manager.init_app(app)

# BASE_URL is now read from environment variable via config module
BASE_URL = config.BASE_URL
USER_DB = {}
for user_id, username in authentication.cursor.execute(
        'SELECT id, username FROM participants'):
    user = users.User(username, user_id)
    if authentication.is_admin_user(username):
        user.make_admin()
    USER_DB[str(user_id)] = user
USER_DB_INV = {
    v.name: k
    for k, v in USER_DB.items()
}


@login_manager.unauthorized_handler
def unauthorized():
    print('Unauthorised access')
    return flask.redirect(f'{BASE_URL}/input/login')


def token_required(f):
    @wraps(f)
    def decorator(*args, **kwargs):
        if 'jwt_token' in flask.request.cookies:
            # Decode the token and check if the user exists.
            try:
                jwt_token_data = jwt.decode(
                    flask.request.cookies.get('jwt_token'), 
                    jwt_secret_key, 
                    algorithms="HS256")
                user_name = jwt_token_data['user']
                if user_name in USER_DB_INV:
                    return f(*args, **kwargs)
                else:
                    return flask.make_response(f'User "{user_name}" does not exist.'), 401
            except jwt.ExpiredSignatureError:
                return (
                    flask.make_response('The authentication token has expired; please login again.'), 
                    401
                )
            except jwt.DecodeError:
                return flask.make_response(
                    'Invalid token; please login again.'), 400
            except Exception as e:
                return flask.make_response(f'Error: {e}'), 500
    return decorator


@login_manager.user_loader
def load_user(user_id):
    return USER_DB.get(user_id, None)


def set_user_authenticated(user_id):
    user = USER_DB.get(user_id, None)
    if user is None:
        raise ValueError(f'No user with id "{user_id}" found.')
    user.authenticated = True


@app.route('/input')
@login_required
def index():
    # Extract the projects available to the current user
    user_id = current_user.get_id()
    projects = utils.get_projects_for_user(int(user_id),
                                           authentication.dbconn)
    # TODO: add projects with public reports
    projects_w_reports = projects
    
    # For admin users, fetch additional data
    all_projects = []
    users = []
    permissions = []
    if current_user.is_admin:
        cursor = authentication.cursor
        # Get all projects
        all_project_rows = cursor.execute('SELECT * FROM `project_info`').fetchall()
        for project_id, project_tag, project_title, _ in all_project_rows:
            if project_tag != 'everything':
                # Get project type
                project_type = None
                for pt_tuple in cursor.execute(
                    'SELECT `project_type` FROM `project_type` WHERE `project_id`=?',
                    (project_id,)
                ):
                    project_type = pt_tuple[0]
                    break
                all_projects.append({
                    'id': project_id,
                    'tag': project_tag,
                    'title': project_title,
                    'type': project_type
                })
        
        # Get all users
        for user_id_val, username, name, email in cursor.execute(
            'SELECT id, username, name, email FROM participants'
        ):
            users.append({
                'id': user_id_val,
                'username': username,
                'name': name,
                'email': email
            })
        
        # Get all permissions
        for user_id_val, project_id, permission_type in cursor.execute(
            'SELECT `user_id`, `project_id`, type FROM permissions'
        ):
            permissions.append({
                'user_id': user_id_val,
                'project_id': project_id,
                'permission': permission_type
            })
    
    return flask.render_template('index.html.jinja',
                                 projects=projects,
                                 projects_w_reports=projects_w_reports,
                                 user_name=current_user.name,
                                 is_admin=current_user.is_admin,
                                 all_projects=all_projects,
                                 users=users,
                                 permissions=permissions)


@app.route('/input/login', methods=['GET', 'POST'])
def login():
    # Here we use a class of some kind to represent and validate our
    # client-side form data. For example, WTForms is a library that will
    # handle this for us, and we use a custom LoginForm to validate.
    login_page_html = flask.render_template('loginform.html.jinja',
                                            form=forms.LoginForm(),
                                            base_url=BASE_URL)
    try:
        form = forms.LoginForm(flask.request.form)
        print(flask.request.form)
    except AttributeError:
        print('No post')
        return login_page_html
    if form.validate():
        print('form is valid')
        username, password = form.username.data, form.password.data
        authentication_status, user_id = authentication.authenticate_user(
            username, password)
        if authentication_status == authentication.AuthStatus.NO_USER:
            print(f'No such user: "{username}".')
            flask.flash(f'No such user: "{username}".')
            return flask.redirect(f'{BASE_URL}/input/login')
        elif authentication_status == authentication.AuthStatus.INCORRECT_PASSWORD:
            print('Incorrect password.')
            flask.flash('Incorrect password.')
            return flask.redirect(f'{BASE_URL}/input/login')
        set_user_authenticated(str(user_id))
        # Check if the user is an admin and set the flag
        user = load_user(str(user_id))
        if authentication.is_admin_user(username):
            user.make_admin()
        login_user(user)
        print(f'Logged in successfully: {user_id} is {user.is_authenticated()}')
        flask.flash('Logged in successfully.')

        response = flask.redirect(f'{BASE_URL}/input')
        response.set_cookie('username', username)
        jwt_token = jwt.encode({'user': username}, jwt_secret_key, algorithm="HS256")
        response.set_cookie('jwt_token', jwt_token)
        return response

    else:
        print('form is invalid')
    # Return empty form
    return login_page_html


@app.route("/input/project", methods=['POST'])
@login_required
def project_redirect():
    project_tag = flask.request.form['project']
    return flask.redirect(f'{BASE_URL}/input/project/{project_tag}')


@app.route("/reports/projectreport", methods=['POST'])
@login_required
def project_report_redirect():
    project_tag = flask.request.form['project']
    return flask.redirect(f'{BASE_URL}/reports/projectreport/{project_tag}')


@app.route("/input/project/<project_tag>", methods=['GET'])
@login_required
def project(project_tag):
    return flask.render_template(
        'input.html.jinja',
        project_tag=project_tag,
        base_url=f'{BASE_URL}',
        project_title=authentication.get_project_info(project_tag)['title'],
        project_type=utils.project_types.get(project_tag, 'hieroglyphic'),
        js_store_url=f'{BASE_URL}/static/js',
        static_store_url=f'{BASE_URL}/static',
        user_is_admin='true' if current_user.is_admin else 'false')


@app.route("/reports/projectreport/<project_tag>", methods=['GET'])
@login_required
def project_report(project_tag):
    return flask.render_template(
        'reports.html.jinja',
        project_tag=project_tag,
        project_title=authentication.get_project_info(project_tag)['title'],
        base_url=f'{BASE_URL}',
        js_store_url=f'{BASE_URL}/static/js/reports',
        css_store_url=f'{BASE_URL}/static/css/reports',
        static_store_url=f'{BASE_URL}/static',
        project_type=utils.project_types.get(project_tag, 'hieroglyphic')
    )
        # base_url=f'{BASE_URL}',
# ,
#         js_store_url=f'{BASE_URL}/static/js',
#         user_is_admin='true' if current_user.is_admin else 'false')


@app.route("/input/logout", methods=['POST'])
@login_required
def logout():
    logout_user()
    # TODO: invalidate the JWT token
    return flask.redirect(f'{BASE_URL}/input/login')


# API endpoints --- those protected by a JWT token
@app.route('/api/<project_tag>/stats', methods=['GET'])
@token_required
def stats(project_tag):

    # TODO: check if user has read access to the project

    response = flask.make_response(
        flask.jsonify(TP.get_stats(project_tag))
    )
    response.headers['Access-Control-Allow-Origin'] = utils.ORIGIN
    response.headers['Content-Type'] = 'application/json'
    return response


@app.route('/api/<project_tag>/info', methods=['GET'])
@token_required
def info(project_tag):

    # TODO: check if user has read access to the project

    project_data = authentication.get_project_info(project_tag)
    project_data['open_for_browsing'] = bool(project_data['open_for_browsing'])
    resp = flask.make_response(flask.jsonify(project_data), 200)
    utils.populate_headers_json(resp)
    return resp


@app.route('/api/<project_tag>/getxlsx', methods=['GET'])
@token_required
def excel_handler(project_tag):
    user_id = current_user.get_id()
    auth_conn = sqlite3.connect(f'../data/auth/auth.sqlite')
    project_id = utils.get_project_id(project_tag, auth_conn)
    access = utils.get_access_level(user_id, project_id, auth_conn)
    # access = authentication.check_user_access(user_id, project_tag)
    # print(user_id, project_tag, access)
    if access is None:
        return RH.no_read_access(app)
    conn = sqlite3.connect(f'../data/projects/{project_tag}/clf.db')
    cursor = conn.cursor()
    return RH.getxlsx(app, project_tag, cursor)


@app.route('/api/<project_tag>/<table_name>/<action>', methods=['POST', 'GET'])
@token_required
def request_handler(project_tag, table_name, action):
    request = flask.request

    user_id = current_user.get_id()
    access = authentication.check_user_access(user_id, project_tag)

    conn = sqlite3.connect(f'../data/projects/{project_tag}/clf.db')
    c = conn.cursor()

    # Two types of tables --- objects and witness_tla_info --- may be missing
    # from old projects. They should be created on the fly.
    utils.check_objects_table(conn, c, table_name)

    # Restart the original action
    table_names = c.execute(
        "SELECT name FROM sqlite_master WHERE type='table';")
    table_names = [el[0] for el in table_names if el[0] != 'sqlite_sequence']
    if table_name not in table_names:
        resp = flask.make_response('No such table', 400)
        RH.populate_headers_plain(resp)
        return resp
    elif action not in utils.GET_ACTIONS + utils.POST_ACTIONS:
        resp = flask.make_response('This action is not available', 400)
        RH.populate_headers_plain(resp)
        return resp
    elif (action in utils.GET_ACTIONS and request.method == 'POST') or \
            (action in utils.POST_ACTIONS and request.method == 'GET'):
        resp = flask.make_response(
            f'Wrong request method "{request.method}" for action "{action}"',
            400)
        RH.populate_headers_plain(resp)
        return resp

    ### GET ###

    if action == 'all':
        return RH.get_all(app, table_name, c)
    elif action == 'ids':
        return RH.get_ids(app, table_name, c)
    elif action == 'byid':
        return RH.byid(app, request, table_name, c)
    elif action == 'byforeignid':
        return RH.byforeignid(app, request, table_name, c)
    elif action == 'bycolumnname':
        return RH.bycolumnname(app, request, table_name, c)
    elif action == 'allclfs':
        resp = flask.make_response(
            flask.jsonify(Analysis.get_all_clfs(c)),
            200)
        RH.populate_headers_json(resp)
        return resp
    elif action == 'clfreport':
        return RH.clfreport(app, request, c)
    elif action == 'getxlsx':
        return RH.getxlsx(app, project_tag, c)


    ### POST ###

    # Previously a part of the API; now a helper function
    elif action == 'add':
        return RH.add_record(app, access, request, table_name, conn, c)

    # New API
    elif action == 'holisticadd':
        if table_name == 'tokens':
            return RH.holisticadd_token(app, access, request, conn, c)
        elif table_name == 'texts':
            return RH.holisticadd_supertext(app, access, request, conn, c)
        elif table_name == 'witnesses':
            return RH.holisticadd_witness(app, access, request, conn, c)
        elif table_name == 'lemmas':
            return RH.holisticadd_lemmas(app, access, request, conn, c)
        else:
            raise NotImplementedError
    elif action == 'holisticdelete':
        # Deletes the item by id together with all dependent items.
        if table_name == 'tokens':
            return RH.holisticdel_token(app, access, request, conn, c)
        elif table_name == 'texts':
            return RH.holisticdel_supertext(app, access, request, conn, c)
        elif table_name == 'witnesses':
            return RH.holisticdel_witness(app, access, request, conn, c)
        elif table_name == 'lemmas':
            return RH.holisticdel_lemma(app, access, request, conn, c)
        else:
            raise NotImplementedError
    elif action == 'addtokenstowitness':
        return RH.addtokenstowitness(app, access, request, conn, c)
    elif action == 'addtokenstowitnesstransliteration':
        return RH.addtokenstowitnesstransliteration(app, access, request, conn, c)
    elif action == 'addclfannotations':
        return RH.addclfannotations(app, access, request, conn, c)

    # Legacy API
    elif action == 'addmultiple':
        return RH.addmultiple(app, access, request, table_name, conn, c)
    elif action == 'deletebyid':
        return RH.deletebyid(app, access, request, table_name, conn, c)
    elif action == 'deletebyidmultiple':
        return RH.deletebyidmultiple(app, access, request, table_name, conn, c)
    elif action == 'deletebyforeignkey':
        return RH.deletebyforeignkey(app, access, request, table_name, conn, c)
    elif action == 'replacebyforeignkey':
        return RH.replacebyforeignkey(app, access, request, table_name, conn, c)
    elif action == 'updaterecord':
        return RH.updaterecord(app, access, request, table_name, conn, c)
    elif action == 'updateclfparses':
        return RH.updateclfparses(app, access, request, conn, c)
    elif action == 'clearcompoundids':
        return RH.clearcompoundids(app, access, request, conn, c)
    elif action == 'setcompoundids':
        return RH.setcompoundids(app, access, request, conn, c)


@app.route('/api/admincomments/<project_tag>/<table_name>/<item_id>/<action>', methods=['POST', 'GET'])
@token_required
def admincomments_handler(project_tag, table_name, item_id, action):
    username = current_user.name
    request = flask.request
    if (
        action == 'updateadmincomment' and
        username not in ['haleliharel', 'orlygoldwasser'] and
        not (username == 'gebhardselz' and project_tag == 'gebhardselz')
    ):
        resp = flask.make_response(
            f'The user {username} is not in the admin list for this project.', 401)
        RH.populate_headers_plain(resp)
        return resp

    if action not in ['getadmincomment', 'updateadmincomment']:
        resp = flask.make_response(f'Unsupported action: {action}.', 400)
        RH.populate_headers_plain(resp)
        return resp
    elif action == 'getadmincomment' and request.method != 'GET' or \
        action == 'updateadmincomment' and request.method != 'POST':
        resp = flask.make_response(
            f'Wrong method {request.method} for action {action}.', 400)
        RH.populate_headers_plain(resp)
        return resp

    dbconn = sqlite3.connect('../data/projects/admincomments.db')
    cursor = dbconn.cursor()
    if action == 'getadmincomment':
        result = {}
        for record_id, comment, username in cursor.execute("""
            SELECT id, comment, user FROM comments
            WHERE `project_tag` = ?
            AND `project_table` = ?
            AND `element_id` = ?
        """,
        (project_tag, table_name, item_id)):
            result[record_id] = {
                'comment': comment,
                'username': username
            }
        resp = flask.make_response(flask.jsonify(result), 200)
        RH.populate_headers_json(resp)
        return resp
    else:  # updateadmincomment
        try:
            POST_DATA = json.loads(request.data)
        except json.decoder.JSONDecodeError as e:
            resp = flask.make_response(f'Bad JSON: {e}', 400)
            RH.populate_headers_plain(resp)
            return resp

        for field_name in ['comment']:
            if field_name not in POST_DATA:
                resp = flask.make_response(
                    f'The field {field_name} must be present in the data.', 400)
                RH.populate_headers_plain(resp)
                return resp
        
        try:
            cursor.execute("""
                DELETE FROM comments
                WHERE `project_tag` = ?
                AND `project_table` = ?
                AND `element_id` = ?
                AND `user` = ?
            """, (project_tag, table_name, item_id, username))
            cursor.execute("""
                INSERT INTO comments (
                    `project_tag`, 
                    `project_table`, 
                    `element_id`, 
                    `comment`, 
                    `user`
                ) VALUES (?,?,?,?,?)
            """,
            (project_tag, table_name, item_id, POST_DATA['comment'], username))
            dbconn.commit()
            return RH.update_successful(app)
        except Exception as e:
            resp = flask.make_response(f'An error has occurred: {e}', 500)
            RH.populate_headers_plain(resp)
            return resp


@app.route('/api/readonly/<project_name>/<table_name>/<action>', methods=['GET'])
@token_required
def readonly_handler(project_name, table_name, action):
    """
    A read-only route for reports.
    """
    
    conn = sqlite3.connect(f'../data/projects/{project_name}/clf.db')
    c = conn.cursor()
    table_names = c.execute(
        "SELECT name FROM sqlite_master WHERE type='table';"
    )
    table_names = [el[0] for el in table_names if el[0] != 'sqlite_sequence']

    if table_name not in table_names:
        resp = flask.make_response('No such table', 400)
        RH.populate_headers_plain(resp)
        return resp

    if action == 'all':
        return RH.readonly_get_all(app, table_name, c)
    elif action == 'byid':
        return RH.readonly_byid(app, flask.request, table_name, c)
    elif action == 'byforeignid':
        return RH.readonly_byforeignid(app, flask.request, table_name, c)
    elif action == 'allclfs':
        resp = flask.make_response(flask.jsonify(Analysis.get_all_clfs(c)),
                                   200)
        RH.populate_headers_json(resp)
        return resp
    elif action == 'clfreport':
        return RH.readonly_clfreport(app, flask.request, c)


# Admin routes
@app.route('/api/admin/projects/list', methods=['GET'])
@login_required
def admin_list_projects():
    """Get list of all projects for admin."""
    if not current_user.is_admin:
        return flask.make_response('Unauthorized', 403)
    
    cursor = authentication.cursor
    projects = []
    project_rows = cursor.execute('SELECT * FROM `project_info`').fetchall()
    for project_id, project_tag, project_title, _ in project_rows:
        if project_tag != 'everything':
            # Get project type
            project_type = None
            for pt_tuple in cursor.execute(
                'SELECT `project_type` FROM `project_type` WHERE `project_id`=?',
                (project_id,)
            ):
                project_type = pt_tuple[0]
                break
            projects.append({
                'id': project_id,
                'tag': project_tag,
                'title': project_title,
                'type': project_type
            })
    resp = flask.make_response(flask.jsonify(projects), 200)
    utils.populate_headers_json(resp)
    return resp


@app.route('/api/admin/users/list', methods=['GET'])
@login_required
def admin_list_users():
    """Get list of all users for admin."""
    if not current_user.is_admin:
        return flask.make_response('Unauthorized', 403)
    
    cursor = authentication.cursor
    users = []
    for user_id, username, name, email in cursor.execute(
        'SELECT id, username, name, email FROM participants'
    ):
        users.append({
            'id': user_id,
            'username': username,
            'name': name,
            'email': email
        })
    
    resp = flask.make_response(flask.jsonify(users), 200)
    utils.populate_headers_json(resp)
    return resp


@app.route('/api/admin/projects/create', methods=['POST'])
@login_required
def admin_create_project():
    """Create a new project."""
    if not current_user.is_admin:
        return flask.make_response('Unauthorized', 403)
    
    data = flask.request.get_json()
    project_tag = data.get('tag', '').strip()
    project_title = data.get('name', '').strip()
    project_type = data.get('type', '').strip()
    
    # Validate input
    if not project_tag or not project_title or not project_type:
        resp = flask.make_response('Missing required fields', 400)
        utils.populate_headers_plain(resp)
        return resp
    
    # Check tag format (lowercase letters only)
    import re
    if not re.fullmatch(r'[a-z]+', project_tag):
        resp = flask.make_response('Tag must consist of lowercase letters only', 400)
        utils.populate_headers_plain(resp)
        return resp
    
    cursor = authentication.cursor
    
    # Check if tag already exists
    for existing_tag in cursor.execute(
        'SELECT `project_id` FROM `project_info`'
    ):
        if existing_tag[0] == project_tag:
            resp = flask.make_response('Project tag already exists', 400)
            utils.populate_headers_plain(resp)
            return resp
    
    # Create the project
    cursor.execute(
        '''
        INSERT INTO `project_info` 
            (`project_id`, title, `open_for_browsing`)
        VALUES (?, ?, ?)''',
        (project_tag, project_title, 1))
    project_id = cursor.lastrowid
    
    # Add project type
    cursor.execute(
        '''
        INSERT INTO `project_type` (`project_id`, `project_type`)
        VALUES (?, ?)''',
        (project_id, project_type))
    
    authentication.dbconn.commit()
    
    # Update project_types.json
    import os
    project_types_path = '../data/project_types.json'
    if os.path.exists(project_types_path):
        with open(project_types_path, 'r', encoding='utf8') as inp:
            project_type_dict = json.load(inp)
        project_type_dict[project_tag] = project_type
        with open(project_types_path, 'w', encoding='utf8') as out:
            json.dump(project_type_dict, out, indent=2)
    
    # Create empty project database
    import os

    init_script_path = os.path.join('../data/projects', 'create_empty_project.sql')
    try:
        with open(init_script_path, 'r') as inp:
            sql_script = inp.read()
    except (FileNotFoundError, IOError) as e:
        app.logger.error('Failed to read SQL init script from %s: %s', init_script_path, e)
        return flask.make_response(flask.jsonify({
            'error': 'Failed to initialize project database: SQL script file is missing or unreadable.'
        }), 500)
    project_dir_path = os.path.join('../data/projects', project_tag)
    os.makedirs(project_dir_path, exist_ok=True)
    project_db_path = os.path.join(project_dir_path, 'clf.db')
    with sqlite3.connect(project_db_path) as project_conn:
        project_cursor = project_conn.cursor()
        project_cursor.executescript(sql_script)
        project_conn.commit()
    
    resp = flask.make_response(flask.jsonify({
        'id': project_id,
        'tag': project_tag,
        'title': project_title,
        'type': project_type
    }), 201)
    utils.populate_headers_json(resp)
    return resp


@app.route('/api/admin/users/create', methods=['POST'])
@login_required
def admin_create_user():
    """Create a new user."""
    if not current_user.is_admin:
        return flask.make_response('Unauthorized', 403)
    
    data = flask.request.get_json()
    username = data.get('username', '').strip()
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    
    # Validate input
    if not username or not name or not email or not password:
        resp = flask.make_response('Missing required fields', 400)
        utils.populate_headers_plain(resp)
        return resp
    
    # Check username format (lowercase letters only)
    import re
    if not re.fullmatch(r'[a-z]+', username):
        resp = flask.make_response('Username must consist of lowercase letters only', 400)
        utils.populate_headers_plain(resp)
        return resp
    
    cursor = authentication.cursor
    
    # Check if username already exists
    for existing_username in cursor.execute(
        'SELECT username FROM participants'
    ):
        if existing_username[0] == username:
            resp = flask.make_response('Username already exists', 400)
            utils.populate_headers_plain(resp)
            return resp
    
    # Create the user
    cursor.execute(
        '''
        INSERT INTO participants (username, name, email)
        VALUES (?, ?, ?)''',
        (username, name, email))
    user_id = cursor.lastrowid
    
    # Set password
    password_hash = authentication.hashpass(password).decode('ascii')
    cursor.execute(
        '''
        INSERT INTO passwd (hash, user_id)
        VALUES (?, ?)''',
        (password_hash, user_id))
    
    authentication.dbconn.commit()
    
    # Update USER_DB
    USER_DB[str(user_id)] = users.User(username, user_id)
    USER_DB_INV[username] = str(user_id)
    
    resp = flask.make_response(flask.jsonify({
        'id': user_id,
        'username': username,
        'name': name,
        'email': email
    }), 201)
    utils.populate_headers_json(resp)
    return resp


@app.route('/api/admin/permissions/set', methods=['POST'])
@login_required
def admin_set_permissions():
    """Set user permissions for a project."""
    if not current_user.is_admin:
        return flask.make_response('Unauthorized', 403)
    
    data = flask.request.get_json()
    user_id = data.get('user_id')
    project_id = data.get('project_id')
    permission_type = data.get('permission_type')  # 'read', 'write', or 'none'
    
    # Validate input
    if user_id is None or project_id is None or permission_type is None:
        resp = flask.make_response('Missing required fields', 400)
        utils.populate_headers_plain(resp)
        return resp
    
    if permission_type not in ['read', 'write', 'none']:
        resp = flask.make_response('Invalid permission type', 400)
        utils.populate_headers_plain(resp)
        return resp
    
    cursor = authentication.cursor
    
    # Remove existing permissions for this user and project
    cursor.execute(
        'DELETE FROM permissions WHERE `user_id`=? AND `project_id`=?',
        (user_id, project_id))
    
    # Add new permission if not 'none'
    if permission_type != 'none':
        cursor.execute(
            '''
            INSERT INTO permissions (`user_id`, `project_id`, type)
            VALUES (?, ?, ?)
            ''',
            (user_id, project_id, permission_type))
    
    authentication.dbconn.commit()
    
    resp = flask.make_response(flask.jsonify({
        'user_id': user_id,
        'project_id': project_id,
        'permission': permission_type
    }), 200)
    utils.populate_headers_json(resp)
    return resp


@app.route('/api/admin/permissions/list', methods=['GET'])
@login_required
def admin_list_permissions():
    """Get all permissions."""
    if not current_user.is_admin:
        return flask.make_response('Unauthorized', 403)
    
    cursor = authentication.cursor
    permissions = []
    for user_id, project_id, permission_type in cursor.execute(
        'SELECT `user_id`, `project_id`, type FROM permissions'
    ):
        permissions.append({
            'user_id': user_id,
            'project_id': project_id,
            'permission': permission_type
        })
    
    resp = flask.make_response(flask.jsonify(permissions), 200)
    utils.populate_headers_json(resp)
    return resp


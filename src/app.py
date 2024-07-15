from functools import wraps
import flask
from flask_login import *
import jwt
import forms
import users
import authentication
import utils


app = flask.Flask(__name__)
with open('../data/auth/secretkey', 'r', encoding='utf-8') as inp:
    app.secret_key = bytes(inp.read().strip(), encoding='utf-8')
with open('../data/auth/jwtsecretkey', 'r', encoding='utf-8') as inp:
    jwt_secret_key = inp.read()

login_manager = LoginManager()
login_manager.init_app(app)

BASE_URL = 'https://iclassifier.click'
USER_DB = {
    str(user_id): users.User(username, user_id)
    for user_id, username in authentication.cursor.execute(
        'SELECT id, name FROM participants')
}
USER_DB_INV = {
    v.name: k
    for k, v in USER_DB.items()
}


@login_manager.unauthorized_handler
def unauthorized():
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


@app.route('/index')
@app.route('/')
@login_required
def index():
    # Extract the projects available to the current user
    user_id = current_user.get_id()
    projects = utils.get_projects_for_user(int(user_id),
                                           authentication.dbconn)
    # print(user_id, projects)
    return flask.render_template('index.html.jinja',
                                 projects=projects,
                                 user_name=current_user.name)


@app.route('/login', methods=['GET', 'POST'])
def login():
    # Here we use a class of some kind to represent and validate our
    # client-side form data. For example, WTForms is a library that will
    # handle this for us, and we use a custom LoginForm to validate.
    login_page_html = flask.render_template('loginform.html.jinja',
                                            form=forms.LoginForm())
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
            flask.flash(f'No such user: "{username}".')
            return flask.redirect(f'{BASE_URL}/input/login')
        elif authentication_status == authentication.AuthStatus.INCORRECT_PASSWORD:
            flask.flash('Incorrect password.')
            return flask.redirect(f'{BASE_URL}/input/login')
        set_user_authenticated(str(user_id))
        # TODO: Check if the user is an admin and set the flag
        user = load_user(str(user_id))
        login_user(user)
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


@app.route("/project/<project_tag>", methods=['GET'])
@login_required
def project(project_tag):
    return flask.render_template(
        'input.html.jinja',
        project_tag=project_tag,
        base_url=f'{BASE_URL}',
        project_title=authentication.get_project_info(project_tag)[2],
        project_type=utils.project_types.get(project_tag, 'hieroglyphic'),
        js_store_url=f'{BASE_URL}/static/js',
        static_store_url=f'{BASE_URL}/static',
        user_is_admin='true' if current_user.is_admin else 'false')


@app.route("/project", methods=['POST'])
@login_required
def project_redirect():
    project_tag = flask.request.form['project']
    return flask.redirect(f'{BASE_URL}/input/project/{project_tag}')


@app.route("/logout", methods=['POST'])
@login_required
def logout():
    logout_user()
    # TODO: invalidate the JWT token
    return flask.redirect(f'{BASE_URL}/input/login')


# API endpoints --- those protected by a JWT token

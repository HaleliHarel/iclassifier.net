import flask
from flask_login import *
import forms
import users
import authentication
import utils


app = flask.Flask(__name__)
with open('../data/auth/secretkey', 'r', encoding='utf-8') as inp:
    app.secret_key = bytes(inp.read().strip())

login_manager = LoginManager()
login_manager.init_app(app)
# Register the login view
login_manager.login_view = "login"


USER_DB = {
    str(user_id): users.User(username, user_id)
    for user_id, username in authentication.cursor.execute(
        'SELECT id, name FROM participants')
}


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
            return flask.redirect(flask.url_for('login'))
        elif authentication_status == authentication.AuthStatus.INCORRECT_PASSWORD:
            flask.flash('Incorrect password.')
            return flask.redirect(flask.url_for('login'))
        set_user_authenticated(str(user_id))
        # TODO: Check if the user is an admin and set the flag
        user = load_user(str(user_id))
        login_user(user)
        flask.flash('Logged in successfully.')

        response = flask.make_response(flask.redirect(flask.url_for('index')))
        response.set_cookie('username', username)
        response.set_cookie('auth_token', 'auth token will be here')
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
        base_url='127.0.0.1:8000',
        project_title=authentication.get_project_info(project_tag)[2],
        project_type=utils.project_types.get(project_tag, 'hieroglyphic'),
        js_store_url='https://iclassifier.click/static/js',
        static_store_url='https://iclassifier.click/static',
        user_is_admin='true' if current_user.is_admin else 'false')


@app.route("/project", methods=['POST'])
@login_required
def project_redirect():
    project_tag = flask.request.form['project']
    return flask.redirect(flask.url_for(f'project', project_tag=project_tag))


@app.route("/logout", methods=['POST'])
@login_required
def logout():
    logout_user()
    return flask.redirect(flask.url_for('index'))



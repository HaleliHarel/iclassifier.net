class User:
    def __init__(self, name, user_id, active=True):
        self.name = name
        self.id = user_id
        self.active = active
        self.authenticated = False
        self.is_admin = False

    def is_active(self):
        # Here you should write whatever the code is
        # that checks the database if your user is active
        return self.active

    def is_anonymous(self):
        return False

    def is_authenticated(self):
        return self.authenticated

    def get_id(self):
        return str(self.id)
    
    def make_admin(self):
        self.is_admin = True
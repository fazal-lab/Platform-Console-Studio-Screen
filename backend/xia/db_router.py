"""
XIA Database Router
--------------------
Routes all XIA models (ScreenMaster, SlotBooking, ChatSession)
to the 'xia_db' database. All other models use 'default'.
"""


class XiaRouter:
    """Route XIA models to xia_db database."""

    APP_LABEL = 'xia'

    def db_for_read(self, model, **hints):
        if model._meta.app_label == self.APP_LABEL:
            return 'xia_db'
        return None

    def db_for_write(self, model, **hints):
        if model._meta.app_label == self.APP_LABEL:
            return 'xia_db'
        return None

    def allow_relation(self, obj1, obj2, **hints):
        # Allow relations between XIA models
        if (obj1._meta.app_label == self.APP_LABEL or
                obj2._meta.app_label == self.APP_LABEL):
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if app_label == self.APP_LABEL:
            return db == 'xia_db'
        if db == 'xia_db':
            return False
        return None

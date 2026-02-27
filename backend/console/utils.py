from .models import AuditLog

def log_action(user, action, component, target_id=None, payload=None, request=None):
    """
    Utility to record actions in the AuditLog.
    """
    ip_address = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0]
        else:
            ip_address = request.META.get('REMOTE_ADDR')

    AuditLog.objects.create(
        user=user,
        action=action,
        component=component,
        target_id=str(target_id) if target_id else None,
        payload=payload or {},
        ip_address=ip_address
    )

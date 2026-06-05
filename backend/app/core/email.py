"""
Email utility — sends transactional email over SMTP (e.g. Mailcow).

Configured via SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD /
SMTP_USE_TLS / SMTP_USE_SSL and FROM_EMAIL / FROM_NAME in settings.
Keeps the same send_email(to, subject, html_body, text_body) -> bool interface
all callers already use.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def _html_to_text(html_body: str) -> str:
    return (
        html_body
        .replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
        .replace("</p>", "\n").replace("<p>", "")
    )


def send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    """Send an email via SMTP. Returns True on success, False otherwise."""
    if not settings.SMTP_HOST:
        logger.error("SMTP_HOST not configured; cannot send email")
        return False

    from_email = settings.FROM_EMAIL or settings.SMTP_USER or "no-reply@example.com"
    from_name = settings.FROM_NAME or "VistaSign"
    plain_body = text_body if text_body is not None else _html_to_text(html_body)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = to_email
    if settings.SUPPORT_EMAIL:
        msg["Reply-To"] = settings.SUPPORT_EMAIL
    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    host, port = settings.SMTP_HOST, settings.SMTP_PORT or 587
    logger.info(f"Sending email to {to_email} via SMTP {host}:{port}")

    try:
        if settings.SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
        try:
            server.ehlo()
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                server.starttls()
                server.ehlo()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            server.sendmail(from_email, [to_email], msg.as_string())
        finally:
            try:
                server.quit()
            except Exception:
                pass
        logger.info(f"Successfully sent email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"SMTP error sending email to {to_email}: {e}")
        return False

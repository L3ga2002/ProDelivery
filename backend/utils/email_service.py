import asyncio
import logging
import os

import resend

logger = logging.getLogger(__name__)


def build_driver_verification_html(driver_name: str, code: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;margin:0 0 12px">ProDelivery Bacău</p>
        <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px">Confirmare email livrator</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px">Salut, {driver_name}. Folosește codul de mai jos pentru a confirma adresa de email în aplicație.</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:0.18em;text-align:center;background:#0f172a;color:#ffffff;border-radius:10px;padding:16px 20px;margin:18px 0">{code}</div>
        <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0">Codul expiră în 30 de minute. Dacă nu ai cerut acest cont, poți ignora emailul.</p>
      </div>
    </div>
    """


async def send_driver_verification_email(recipient_email: str, driver_name: str, code: str) -> dict:
    resend.api_key = os.environ["RESEND_API_KEY"]
    params = {
        "from": os.environ["SENDER_EMAIL"],
        "to": [recipient_email],
        "subject": "Cod verificare ProDelivery Bacău",
        "html": build_driver_verification_html(driver_name, code),
    }
    try:
        return await asyncio.to_thread(resend.Emails.send, params)
    except Exception as exc:
        logger.exception("Failed to send driver verification email")
        raise RuntimeError("Emailul de verificare nu a putut fi trimis") from exc
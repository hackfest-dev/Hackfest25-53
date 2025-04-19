import imaplib
import smtplib
import email
from email.header import decode_header
from email.mime.text import MIMEText
import getpass

IMAP_SERVER = 'imap.gmail.com'
SMTP_SERVER = 'smtp.gmail.com'
IMAP_PORT = 993
SMTP_PORT = 587

def login_imap(username, password):
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    mail.login(username, password)
    return mail

def fetch_recent_emails(mail, n=5):
    mail.select("inbox")
    result, data = mail.search(None, "ALL")
    mail_ids = data[0].split()
    emails = []
    for num in mail_ids[-n:]:
        result, data = mail.fetch(num, '(RFC822)')
        msg = email.message_from_bytes(data[0][1])
        subject, encoding = decode_header(msg['Subject'])[0]
        if isinstance(subject, bytes):
            subject = subject.decode(encoding if encoding else 'utf-8')
        from_ = msg.get('From')
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                cdispo = str(part.get('Content-Disposition'))
                if ctype == 'text/plain' and 'attachment' not in cdispo:
                    body = part.get_payload(decode=True).decode()
                    break
        else:
            body = msg.get_payload(decode=True).decode()
        emails.append({
            'id': num,
            'from': from_,
            'subject': subject,
            'body': body,
            'msg_obj': msg
        })
    return emails

def send_reply(username, password, to_addr, subject, body, original_msg):
    # Prepare reply headers to keep threading
    reply = MIMEText(body)
    reply['Subject'] = 'Re: ' + subject
    reply['From'] = username
    reply['To'] = to_addr
    if 'Message-ID' in original_msg:
        reply['In-Reply-To'] = original_msg['Message-ID']
        reply['References'] = original_msg['Message-ID']
    # Connect and send
    server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
    server.starttls()
    server.login(username, password)
    server.sendmail(username, to_addr, reply.as_string())
    server.quit()

def main():
    username = input('Gmail address: ')
    password = getpass.getpass('App Password: ')
    mail = login_imap(username, password)
    emails = fetch_recent_emails(mail)
    print("\nRecent Emails:")
    for idx, em in enumerate(emails):
        print(f"\n[{idx}] From: {em['from']}\nSubject: {em['subject']}\nBody Preview: {em['body'][:100]}...")
    idx = int(input("\nEnter the number of the email you want to reply to: "))
    reply_body = input("Type your reply:\n")
    print("\n--- Confirmation ---")
    print(f"Replying to: {emails[idx]['from']}")
    print(f"Subject: Re: {emails[idx]['subject']}")
    print(f"Body:\n{reply_body}")
    confirm = input("Send this reply? (y/n): ").strip().lower()
    if confirm == 'y':
        send_reply(
            username,
            password,
            emails[idx]['from'],
            emails[idx]['subject'],
            reply_body,
            emails[idx]['msg_obj']
        )
        print("Reply sent.")
    else:
        print("Reply canceled.")

if __name__ == "__main__":
    main()

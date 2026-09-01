#!/usr/bin/env python3
"""Send prospecting email to Denver Deck Builders via Brevo."""
import json, os, subprocess, sys, base64

# Read preview image as base64 data URI
with open(r'C:\Users\antoi\Buil AI\tmp\preview-b64.txt') as f:
    b64 = f.read().strip()
data_uri = 'data:image/png;base64,' + b64

# Read Brevo API key from Hermes profile env
env_file = os.path.expanduser(r'~\AppData\Local\hermes\profiles\build\.env')
key = None
with open(env_file, encoding='utf-8', errors='ignore') as f:
    for line in f:
        if line.startswith('BREVO_API_KEY='):
            key = line.strip().split('=', 1)[1]
            break
if not key:
    print("ERROR: BREVO_API_KEY not found")
    sys.exit(1)

text_content = """Hi there,

I took a look at your quote form on Denver Deck Builders. I wanted to share what it would look like if your website could ask about a project before scheduling a call — so your team receives complete, detailed inquiries instead of just names and phone numbers.

Here is the actual intake I set up for your business, live at:
https://metre-pro.com/m/dc00719e841e4c14bb1edaa1b4cec3cc

Would receiving this level of detail about each potential client make your sales process easier? Happy to hop on a quick call to discuss.

Best regards,
Antoine Ferriere
Founder, Metre Build
https://metre-pro.com"""

html_content = f'''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;">
  <div style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="border-bottom:1px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px;">
      <span style="font-size:22px;font-weight:600;color:#1e3a5f;">M\u00e9tr\u00e9 Build</span>
    </div>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin-bottom:20px;">Hi there,</p>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin-bottom:20px;">
      I took a look at your quote form on Denver Deck Builders. I wanted to share what it would look like if your website could ask about a project before scheduling a call — so your team receives complete, detailed inquiries instead of just names and phone numbers.
    </p>
    <div style="text-align:center;margin:24px 0;">
      <img src="{data_uri}" alt="Preview" style="max-width:100%;border-radius:8px;border:1px solid #e2e8f0;">
    </div>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin-bottom:20px;">
      Here is the actual intake I set up for your business, live at:
    </p>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://metre-pro.com/m/dc00719e841e4c14bb1edaa1b4cec3cc" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;font-size:15px;font-weight:500;padding:12px 28px;border-radius:8px;">View Your Project Intake</a>
    </div>
    <p style="font-size:15px;line-height:1.6;color:#334155;margin-bottom:20px;">
      Would receiving this level of detail about each potential client make your sales process easier? Happy to hop on a quick call to discuss.
    </p>
    <p style="font-size:15px;line-height:1.6;color:#334155;">
      Best regards,<br>
      <strong>Antoine Ferriere</strong><br>
      <span style="color:#64748b;">Founder, Metre Build</span><br>
      <a href="https://metre-pro.com" style="color:#64748b;">https://metre-pro.com</a>
    </p>
  </div>
  <div style="text-align:center;margin-top:12px;font-size:12px;color:#94a3b8;">
    <a href="https://metre-pro.com/privacy" style="color:#94a3b8;text-decoration:none;margin:0 8px;">Privacy</a>
    <a href="https://metre-pro.com/terms" style="color:#94a3b8;text-decoration:none;margin:0 8px;">Terms</a>
  </div>
</body>
</html>'''

payload = {
    'sender': {'name': 'Antoine Ferriere', 'email': 'contact@metre-pro.com'},
    'to': [{'email': 'tylergibas@gmail.com', 'name': 'Denver Deck Builders'}],
    'cc': [{'email': 'contact@metre-pro.com', 'name': 'Antoine Ferriere'}],
    'subject': 'Would receiving complete project inquiries make your sales easier?',
    'htmlContent': html_content,
    'textContent': text_content,
}

payload_json = json.dumps(payload)

# Save payload to file
payload_file = r'C:\Users\antoi\Buil AI\tmp\denver_email_payload.json'
with open(payload_file, 'w', encoding='utf-8') as f:
    f.write(payload_json)

print(f"Payload written ({len(payload_json)} bytes)")

# Use --data-binary @file.json to avoid command line length issues
r = subprocess.run([
    'curl', '-s', '-X', 'POST',
    'https://api.brevo.com/v3/smtp/email',
    '-H', f'api-key: {key}',
    '-H', 'Content-Type: application/json',
    '--data-binary', f'@{payload_file}',
], capture_output=True, text=True, timeout=30)

print('STDOUT:', r.stdout)
if r.stderr:
    print('STDERR:', r.stderr, file=sys.stderr)

result = json.loads(r.stdout)
if 'messageId' in result:
    print(f'\n✅ EMAIL ENVOYÉ — messageId: {result["messageId"]}')
    sys.exit(0)
else:
    print(f'\n❌ ÉCHEC: {result}')
    sys.exit(1)
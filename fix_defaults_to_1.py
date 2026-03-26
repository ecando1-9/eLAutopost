import os
import glob

def replace_in_file(filepath, old_text, new_text):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if old_text in content:
        content = content.replace(old_text, new_text)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

# backend/app/api/settings.py
s_path = r"c:\Users\yuvak\Downloads\ecantech_esolutions\projects\linkedin_automation\backend\app\api\settings.py"
replace_in_file(s_path, 'get("max_posts_per_day", 3)', 'get("max_posts_per_day", 1)')
replace_in_file(s_path, '"max_posts_per_day": 3', '"max_posts_per_day": 1')

# backend/app/models/schemas.py
sch_path = r"c:\Users\yuvak\Downloads\ecantech_esolutions\projects\linkedin_automation\backend\app\models\schemas.py"
replace_in_file(sch_path, 'max_posts_per_day: int = Field(default=3', 'max_posts_per_day: int = Field(default=1')

# frontend/src/app/requirements/page.tsx
req_path = r"c:\Users\yuvak\Downloads\ecantech_esolutions\projects\linkedin_automation\frontend\src\app\requirements\page.tsx"
replace_in_file(req_path, 'max_posts_per_day: settings.max_posts_per_day || 3', 'max_posts_per_day: settings.max_posts_per_day || 1')

# frontend/src/app/content/create/page.tsx
create_path = r"c:\Users\yuvak\Downloads\ecantech_esolutions\projects\linkedin_automation\frontend\src\app\content\create\page.tsx"
replace_in_file(create_path, 'schedule.max_posts_per_day || 3', 'schedule.max_posts_per_day || 1')

# Because the user's DB might currently have integer "3", we'll run a quick SQL update to reset them to 1 so the UI changes immediately for the current user.
sql_path = r"c:\Users\yuvak\Downloads\ecantech_esolutions\projects\linkedin_automation\update_posts_day.sql"
with open(sql_path, "w") as f:
    f.write("UPDATE user_settings SET max_posts_per_day = 1 WHERE max_posts_per_day = 3;\n")

print("Files updated")

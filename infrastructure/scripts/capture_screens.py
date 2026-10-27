import time
import os
from playwright.sync_api import sync_playwright

CHROME_PATH = "C:/Users/wondr/AppData/Local/hermes/tools/chromium-1208/chrome-win64/chrome.exe"
OUTPUT_DIR = "C:/Users/wondr/HermesWorkspace/openbizflow/docs/screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=CHROME_PATH,
        headless=True,
    )
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    # 1. Login
    print("Navigating to login...")
    page.goto("http://127.0.0.1:5174/login")
    page.wait_for_selector('input[type="email"]')
    page.fill('input[type="email"]', "admin@openbizflow.io")
    page.fill('input[type="password"]', "Password123!")
    page.click('button[type="submit"]')
    page.wait_for_url("http://127.0.0.1:5174/")
    time.sleep(1.5)

    # 1. Capture Dashboard
    print("Capturing 01-dashboard.png...")
    page.screenshot(path=os.path.join(OUTPUT_DIR, "01-dashboard.png"))

    # 2. Capture Workflow Editor
    print("Capturing 02-workflow-editor.png...")
    page.goto("http://127.0.0.1:5174/workflows")
    page.wait_for_selector("table tbody tr")
    time.sleep(1)
    # Click the first workflow to open editor
    page.click("table tbody tr:first-child a")
    page.wait_for_selector(".react-flow")
    time.sleep(2)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "02-workflow-editor.png"))

    # 3. Capture Approvals Center
    print("Capturing 03-approval-center.png...")
    page.goto("http://127.0.0.1:5174/approvals")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "03-approval-center.png"))

    # 4. Capture Templates Library
    print("Capturing 04-templates-library.png...")
    page.goto("http://127.0.0.1:5174/templates")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "04-templates-library.png"))

    # 5. Capture Execution Details
    print("Capturing 05-execution-details.png...")
    page.goto("http://127.0.0.1:5174/executions")
    page.wait_for_selector("table tbody tr")
    time.sleep(1)
    page.click("table tbody tr:first-child a")
    time.sleep(1.5)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "05-execution-details.png"))

    browser.close()
    print("All screenshots successfully captured!")

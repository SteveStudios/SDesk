import time

import os
import os.path

import sys
import subprocess

import alpm

DB_LOCK_FILE: str = "/var/lib/pacman/db.lck"

# Twenty Minutes
TIMEOUT_SECS: int = 1200

seconds_waited: int = 0

def pacman_in_use() -> bool
    return os.path.isfile(DB_LOCK_FILE)

def get_new_packages(): list
    with open("/SDesk/BasePackages" as file:
        lines = [line.rstrip() for line in file]
        return lines

if pacman_in_use():
    print("Waiting for Pacman to finish...")

while pacman_in_use() and seconds_waited < TIMEOUT_SECS:
    time.sleep(1)
    seconds_waited += 1

if seconds_waited >= TIMEOUT_SECS:
    print("Timeout exceeded 1200s. exiting...")
    sys.exit(1)
else:
    print("Pacman has exited, installing new base packages...")

    header = pyalpm.Handle("/", "/var/lib/pacman")
    localdb = header.get_localdb()

    for package in get_new_packages():
        if package.isspace(): continue
        if package.startswith("[remove]") and len(localdb.search(package.replace("[remove]", "").replace(" ", ""))) > 0:
            print("    - Removing base package: " + package.replace("[remove]", "").replace(" ", ""))
            os.system("pacman -Rdd --noconfirm " + package.replace("[remove]", "").replace(" ", ""))

        if len(localdb.search(package)) > 0: continue

        print("    - Installing new base package: " + package)
        os.system("pacman -S --noconfirm " + package)

print("SDesk is up-to-date.")

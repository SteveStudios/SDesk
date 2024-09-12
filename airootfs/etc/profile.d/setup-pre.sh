#!/bin/bash

if (( EUID != 0 )) && [ ! -f "/etc/profile.d/install.sh" ] && [ ! -f "/etc/profile.d/setup.sh" ] && [ -f "/usr/share/applications/gnome-initial-setup.desktop" ]; then
    trap '' SIGINT
    trap '' SIGTERM

    while ! sudo pgrep -x "gnome-shell" > /dev/null; do
        sleep 1
    done
    
    mplayer /usr/local/share/Welcome_SDESK19.mp3 -loop 0 &
    mpv --ontop --osc=no --fullscreen --on-all-workspaces /usr/local/share/Welcome_SDESK19.mp4 &

    sudo rm -rf /etc/profile.d/setup-pre.sh
fi
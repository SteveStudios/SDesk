#!/bin/bash

sudo rm -rf /usr/bin/setup-pre.sh

mplayer /usr/local/share/Welcome_SDESK19.mp3 -loop 0 &
mpv --ontop --osc=no --fullscreen --on-all-workspaces /usr/local/share/Welcome_SDESK19.mp4 
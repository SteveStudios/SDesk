#!bin/bash

if (( $EUID != 0 )); then
    mplayer /usr/share/gnome-shell/login.mp3
fi
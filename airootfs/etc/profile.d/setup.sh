#!/bin/bash

if (( $EUID != 0 )); then
	dconf reset -f /org/gnome/

	gsettings set org.gnome.desktop.background picture-uri file:////usr/share/pixmaps/sd-bg-default.png
	gsettings set org.gnome.desktop.background picture-uri-dark file:////usr/share/pixmaps/sd-bg-default.png
	
 	gsettings set org.gnome.shell favorite-apps "['calamares.desktop', 'swirl.desktop', 'org.gnome.Geary.desktop', 'org.gnome.Calendar.desktop', 'org.gnome.Music.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.Software.desktop']"

	xdg-settings set default-web-browser swirl.desktop

	sudo systemctl start cups.service
	sudo systemctl enable cups.service
	
	sudo systemctl enable bluetooth
	sudo systemctl start bluetooth
	
	rfkill block bluetooth
	
	sudo calamares
fi
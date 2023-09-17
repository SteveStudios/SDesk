#!/bin/bash

if (( $EUID != 0 )) && [ ! -f "/etc/profile.d/install.sh" ] && [ ! -f "/etc/profile.d/setup.sh" ]; then
	dconf reset -f /org/gnome/

	gsettings set org.gnome.desktop.background picture-uri file:////usr/share/pixmaps/sd-bg-default.png
	gsettings set org.gnome.desktop.background picture-uri-dark file:////usr/share/pixmaps/sd-bg-default.png

 	gsettings set org.gnome.shell favorite-apps "['swirl.desktop', 'org.gnome.Geary.desktop', 'org.gnome.Calendar.desktop', 'org.gnome.Music.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.Software.desktop']"
		
	xdg-settings set default-web-browser swirl.desktop

	rm -f /etc/profile.d/setup-final.sh
	chmod -R 700 /etc/profile.d
fi
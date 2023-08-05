#!/bin/bash

if (( $EUID != 0 )) && [ -f "/etc/profile.d/install.sh" ]; then
	dconf reset -f /org/gnome/
	
	gsettings set org.gnome.desktop.background picture-uri file:////usr/share/pixmaps/sd-bg-default.png
 	gsettings set org.gnome.shell favorite-apps "['calamares.desktop', 'firefox.desktop', 'thunderbird.desktop', 'org.gnome.Calendar.desktop', 'org.gnome.Music.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.Software.desktop']"
		
	xdg-settings set default-web-browser firefox.desktop
	
	sudo rm -rf /etc/profile.d/install.sh
	sudo calamares
fi

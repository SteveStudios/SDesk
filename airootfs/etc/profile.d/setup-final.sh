#!/bin/bash

if (( $EUID != 0 )) && [ ! -f "/etc/profile.d/install.sh" ] && [ ! -f "/etc/profile.d/setup.sh" ]; then
	dconf reset -f /org/gnome/

	sudo chmod 777 /usr/share/gnome-shell/extensions/appindicatorsupport@rgcjonas.gmail.com/*
	sudo chmod 777 /usr/share/gnome-shell/extensions/gtk4-ding@smedius.gitlab.com/*

	gnome-extensions enable places-menu@gnome-shell-extensions.gcampax.github.com
	gnome-extensions enable apps-menu@gnome-shell-extensions.gcampax.github.com
	
	gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com
	gnome-extensions enable gtk4-ding@smedius.gitlab.com
	
	gsettings set org.gnome.desktop.wm.preferences button-layout ':minimize,maximize,close'

	gsettings set org.gnome.desktop.background picture-uri file:////usr/share/pixmaps/sd-bg-default.png
	gsettings set org.gnome.desktop.background picture-uri-dark file:////usr/share/pixmaps/sd-bg-default.png

 	gsettings set org.gnome.shell favorite-apps "['swirl.desktop', 'org.gnome.Geary.desktop', 'org.gnome.Calendar.desktop', 'org.gnome.Music.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.Software.desktop']"
		
	xdg-settings set default-web-browser swirl.desktop

	rm -f /etc/profile.d/setup-final.sh
	chmod -R 700 /etc/profile.d
fi
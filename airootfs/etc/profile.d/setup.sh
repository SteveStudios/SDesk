#!/bin/bash

if (( $EUID != 0 )); then
	dconf reset -f /org/gnome/

	sudo chmod 777 /usr/share/gnome-shell/extensions/add-to-desktop@tommimon.github.com/*
	sudo chmod 777 /usr/share/gnome-shell/extensions/arcmenu@arcmenu.com/*
	sudo chmod 777 /usr/share/gnome-shell/extensions/blur-my-shell@aunetx/*
	sudo chmod 777 /usr/share/gnome-shell/extensions/dash-to-dock@micxgx.gmail.com/*
	sudo chmod 777 /usr/share/gnome-shell/extensions/gtk4-ding@smedius.gitlab.com/*

	gnome-extensions enable places-menu@gnome-shell-extensions.gcampax.github.com
	gnome-extensions enable apps-menu@gnome-shell-extensions.gcampax.github.com

	gnome-extensions enable add-to-desktop@tommimon.github.com	
	gnome-extensions enable arcmenu@arcmenu.com
	gnome-extensions enable blur-my-shell@aunetx
	gnome-extensions enable dash-to-dock@micxgx.gmail.com	
	gnome-extensions enable gtk4-ding@smedius.gitlab.com

	gsettings set org.gnome.desktop.wm.preferences button-layout ':minimize,maximize,close'

	gsettings set org.gnome.desktop.background picture-uri file:////usr/share/pixmaps/sd-bg-default.png
	gsettings set org.gnome.desktop.background picture-uri-dark file:////usr/share/pixmaps/sd-bg-default.png
	
 	gsettings set org.gnome.shell favorite-apps "['calamares.desktop', 'firefox.desktop', 'thunderbird.desktop', 'org.gnome.Calendar.desktop', 'org.gnome.Music.desktop', 'org.gnome.Nautilus.desktop', 'org.gnome.Software.desktop']"
		
	xdg-settings set default-web-browser firefox.desktop
	
	sudo systemctl enable bluetooth
	sudo systemctl start bluetooth
	
	rfkill block bluetooth
	
	sudo calamares
fi
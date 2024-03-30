#!/bin/bash

if (( $EUID != 0 )); then
	gsettings set org.gnome.shell welcome-dialog-last-shown-version '4294967295'
	sudo dconf update

	gsettings set org.gnome.desktop.wm.preferences button-layout ":minimize,maximize,close"
	
	gnome-extensions enable user-theme@gnome-shell-extensions.gcampax.github.com
	gnome-extensions enable add-to-desktop@tommimon.github.com
	gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com
	gnome-extensions enable dash-to-dock@micxgx.gmail.com
	gnome-extensions enable gtk4-ding@smedius.gitlab.com
	gnome-extensions enable just-perfection-desktop@just-perfection
	gnome-extensions enable blur-my-shell@aunetx
	gnome-extensions enable tiling-assistant@leleat-on-github
	gnome-extensions enable arch-update@RaphaelRochet
	gnome-extensions enable desktop-cube@schneegans.github.com
	gnome-extensions enable blurmylightshell@dikasp.gitlab
	
	dconf write /org/gnome/shell/extensions/arch-update/notify true
	dconf write /org/gnome/shell/extensions/dash-to-dock/extend-height true
	dconf write /org/gnome/shell/extensions/dash-to-dock/show-apps-at-top true
	dconf write /org/gnome/shell/extensions/dash-to-dock/custom-theme-shrink true
	dconf write /org/gnome/shell/extensions/dash-to-dock/dock-fixed true
	dconf write /org/gnome/shell/extensions/dash-to-dock/running-indicator-style "'SQUARES'"
	dconf write /org/gnome/shell/extensions/dash-to-dock/always-center-icons true
	dconf write /org/gnome/shell/extensions/dash-to-dock/disable-overview-on-startup true
	dconf write /org/gnome/shell/extensions/dash-to-dock/dock-fixed false

	dconf write /org/gnome/shell/extensions/just-perfection/workspace-switcher-should-show true
	dconf write /org/gnome/shell/extensions/just-perfection/workspace-switcher-size 10
	dconf write /org/gnome/shell/extensions/just-perfection/startup-status 0
	
	gsettings set org.gnome.desktop.interface icon-theme 'kora'
	gsettings set org.gnome.desktop.interface cursor-theme 'SShell'

	dconf write /org/gnome/shell/extensions/blur-my-shell/hacks-level 3
	dconf write /org/gnome/shell/extensions/blur-my-shell/dash-to-dock/blur true
	dconf write /org/gnome/shell/extensions/blur-my-shell/panel/style-panel 1
	dconf write /org/gnome/shell/extensions/blur-my-shell/dash-to-dock/static-blur false

	gsettings set org.gnome.desktop.background picture-uri file:////usr/share/pixmaps/sd-bg-default.png
	gsettings set org.gnome.desktop.background picture-uri-dark file:////usr/share/pixmaps/sd-bg-default.png
	
 	gsettings set org.gnome.shell favorite-apps "['calamares.desktop', 'swirl.desktop', 'org.gnome.Geary.desktop', 'org.gnome.Calendar.desktop', 'org.gnome.Music.desktop', 'org.gnome.Nautilus.desktop', 'octopi.desktop']"

	xdg-settings set default-web-browser swirl.desktop

	sudo chmod 777 /etc/profile.d/setup-final.sh

	sudo systemctl start cups.service
	sudo systemctl enable cups.service
	
	sudo systemctl enable bluetooth
	sudo systemctl start bluetooth
	
	rfkill block bluetooth
	
	sudo calamares
fi

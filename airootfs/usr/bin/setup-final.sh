#!/bin/bash

trap '' SIGINT
trap '' SIGTERM

gsettings set org.gnome.shell welcome-dialog-last-shown-version '4294967295'
gsettings set org.gnome.desktop.wm.preferences button-layout ":minimize,maximize,close"
	
gnome-extensions enable user-theme@gnome-shell-extensions.gcampax.github.com
gnome-extensions enable add-to-desktop@tommimon.github.com
gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com
gnome-extensions enable dash-to-dock@micxgx.gmail.com
gnome-extensions disable gtk4-ding@smedius.gitlab.com
gnome-extensions enable just-perfection-desktop@just-perfection
gnome-extensions enable light-style@gnome-shell-extensions.gcampax.github.com
gnome-extensions enable tiling-assistant@leleat-on-github
gnome-extensions enable arch-update@RaphaelRochet

dconf write /org/gnome/shell/extensions/arch-update/notify false
dconf write /org/gnome/shell/extensions/dash-to-dock/extend-height true
dconf write /org/gnome/shell/extensions/dash-to-dock/show-apps-at-top true
dconf write /org/gnome/shell/extensions/dash-to-dock/custom-theme-shrink true
dconf write /org/gnome/shell/extensions/dash-to-dock/dock-fixed true
dconf write /org/gnome/shell/extensions/dash-to-dock/running-indicator-style "'SQUARES'"
dconf write /org/gnome/shell/extensions/dash-to-dock/always-center-icons true
dconf write /org/gnome/shell/extensions/dash-to-dock/disable-overview-on-startup true
dconf write /org/gnome/shell/extensions/dash-to-dock/dock-fixed false
dconf write /org/gnome/shell/extensions/dash-to-dock/transparency-mode "'FIXED'"
dconf write /org/gnome/shell/extensions/dash-to-dock/background-opacity 0.6
dconf write /org/gnome/shell/extensions/dash-to-dock/autohide false
dconf write /org/gnome/shell/extensions/dash-to-dock/intellihide false

dconf write /org/gnome/shell/extensions/just-perfection/workspace-switcher-should-show true
dconf write /org/gnome/shell/extensions/just-perfection/workspace-switcher-size 10
dconf write /org/gnome/shell/extensions/just-perfection/startup-status 0
	
gsettings set org.gnome.desktop.interface icon-theme 'kora'
gsettings set org.gnome.desktop.interface cursor-theme 'SShell'

gsettings set org.gnome.desktop.background picture-uri file:////usr/share/pixmaps/sd-bg-default.png
gsettings set org.gnome.desktop.background picture-uri-dark file:////usr/share/pixmaps/sd-bg-default.png

gsettings set org.gnome.shell favorite-apps "['swirl.desktop', 'org.gnome.Geary.desktop', 'org.gnome.Calendar.desktop', 'org.gnome.Music.desktop', 'org.gnome.Nautilus.desktop', 'octopi.desktop']"
		
xdg-settings set default-web-browser swirl.desktop

if [ -f "/usr/bin/setup-pre.sh" ]; then
    /usr/bin/setup-pre.sh
fi

sudo chmod -R 755 /etc/profile.d
sudo chmod -R 777 /usr/share/gnome-shell/extensions

trap 'exit' SIGINT
trap 'exit' SIGTERM

sudo usermod -a -G wheel live 
sudo /usr/lib/gnome-initial-setup &

sudo rm -rf /usr/share/applications/gnome-initial-setup.desktop && sudo pkill mplayer && sudo pacman -Rns --noconfirm gnome-initial-setup && sudo rm -rf /usr/bin/setup-final.sh && sudo userdel -f live && sudo rm -rf /etc/gdm/custom.conf && sudo mv /etc/gdm/tmpcustom.conf /etc/gdm/custom.conf && sudo rm -rf /etc/xdg/autostart/sdesk-welcome.desktop && sudo mv /etc/tmpsudoers /etc/sudoers && killall -3 gnome-shell
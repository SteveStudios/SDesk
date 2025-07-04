#!/usr/bin/env bash

sudo rm -rf /usr/share/tmpsettings.conf
sudo rm -rf /usr/share/tmpcalamares.desktop
	
sudo rm -rf /usr/share/tmpbranding
sudo rm -rf /usr/share/tmpmodules

gsettings set org.gnome.desktop.interface icon-theme 'Marwaita-Cyan'
gsettings set org.gnome.desktop.interface gtk-theme 'Marwaita'

gsettings set org.gnome.desktop.interface cursor-theme 'SShell'

dconf write /org/gnome/shell/extensions/user-theme/name "'Default'"
sudo dconf update
	
systemctl enable cups.service | grep "hide_the-output"
systemctl enable firewalld.service | grep "hide_the-output"
systemctl enable NetworkManager.service | grep "hide_the-output"
systemctl enable --now apparmor.service | grep "hide_the-output"
systemctl enable gdm | grep "hide_the-output"

sudo rm -rf /usr/bin/post-install.sh

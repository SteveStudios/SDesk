#!/usr/bin/env bash

# Make sure any user named 'live' doesn't have root permissions after installation
sudo mv /etc/tmpsudoers /etc/sudoers

sudo rm -rf /usr/share/tmpsettings.conf
sudo rm -rf /usr/share/tmpcalamares.desktop
	
sudo rm -rf /usr/share/tmpbranding
sudo rm -rf /usr/share/tmpmodules

sudo rm -rf /usr/bin/neofetch
sudo mv /usr/bin/tmpneofetch /usr/bin/neofetch
	
sudo chmod a+x /usr/bin/neofetch

sudo rm -rf /usr/lib/os-release
sudo mv /usr/lib/tmpos-release /usr/lib/os-release

sudo rm -rf /usr/share/gnome-shell/gnome-shell-theme.gresource
sudo mv /usr/share/gnome-shell/tmpgnome-shell-theme.gresource /usr/share/gnome-shell/gnome-shell-theme.gresource

gsettings set org.gnome.desktop.interface icon-theme 'Arc'
gsettings set org.gnome.desktop.interface cursor-theme 'SShell'

dconf write /org/gnome/shell/extensions/user-theme/name "'SShell'"
sudo dconf update
	
systemctl enable cups.service | grep "hide_the-output"
systemctl enable NetworkManager.service | grep "hide_the-output"
systemctl enable gdm | grep "hide_the-output"

sudo rm -rf /usr/bin/post-install.sh

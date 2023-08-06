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
	
systemctl enable NetworkManager.service | grep "hide_the-output"
systemctl enable gdm | grep "hide_the-output"

sudo rm -rf /usr/bin/post-install.sh
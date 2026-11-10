#!/bin/bash
set -euo pipefail
source /etc/os-release 2>/dev/null || {
  echo "This script requires /etc/os-release to detect the operating system." >&2
  exit 1
}
[[ ${EUID} -ne 0 ]] && {
  echo "Please run this script using sudo." >&2
  exit 1
}
case "${ID:-}" in
  ubuntu)
    [[ ${VERSION_ID%%.*} -ge 24 ]] || {
      echo "This script requires Ubuntu 24.04 or newer." >&2
      exit 1
    }
    echo "Installing Ubuntu dependencies"
    cd ~/
    sudo apt-get install dotnet-sdk-10.0 7zip
    wget -q --show-progress https://github.com/PowerShell/PowerShell/releases/download/v7.6.4/powershell_7.6.4-1.deb_amd64.deb
    sudo dpkg -i powershell_7.6.4-1.deb_amd64.deb
    sudo apt-get install -f
    rm powershell_7.6.4-1.deb_amd64.deb
    wget -q --show-progress https://nodejs.org/dist/v24.16.0/node-v24.16.0-linux-x64.tar.xz
    tar -xf node-v24.16.0-linux-x64.tar.xz
    sudo cp -r node-v24.16.0-linux-x64/* /usr/local/
    rm -rf node-v24.16.0-linux-x64.tar.xz node-v24.16.0-linux-x64/
    ;;
  cachyos | arch)
    echo "Installing Arch dependencies"
    cd ~/
    sudo pacman -S --needed dotnet-sdk-10.0 7zip nodejs npm
    paru -S --needed powershell-bin
    echo "You may need to restart your shell."
    ;;
  *)
    echo "This script requires Ubuntu 24.04+, CachyOS, or Arch." >&2
    exit 1
    ;;
esac

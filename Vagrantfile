# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/impish64"
  
  # Need this plugin to forward file system events from the host to the guest
  # Otherwise watching for file changes is not going to work
  # See https://github.com/adrienkohlbecker/vagrant-fsnotify
  config.vagrant.plugins = ["vagrant-fsnotify"]

  # Expose port 9229 to allow debugging
  config.vm.network :forwarded_port, guest: 9229, host: 9229
  # Expose port 10000 as the default port for quartersbrief
  config.vm.network :forwarded_port, guest: 10000, host: 10000

  config.vm.provider "virtualbox" do |vb|
    # Give the vm more memory than the standard 1024 because we will be handling
    # large amounts of data
    # Processing GameParams.data will fail without this
    vb.memory = "2048"
    vb.name = "quartersbrief"
  end

  # Install NodeJS
  config.vm.provision "shell", inline: <<-SHELL
    curl -fsSL https://deb.nodesource.com/setup_17.x | sudo -E bash -
    sudo apt-get install -y nodejs
    sudo npm install -g grunt-cli
  SHELL

  # act is a tool to run github actions locally for debugging purposes. 
  # It requires docker.
  # Therefore, install docker and configure non-root access. Then install act.
  # Sources: 
  #   https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository
  #   https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user
  #   https://github.com/nektos/act#bash-script
  config.vm.provision "shell", inline: <<-SHELL
    sudo apt install ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install docker-ce docker-ce-cli containerd.io
    sudo groupadd docker
    sudo usermod -aG docker vagrant

    cd /usr/local/ && curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
  SHELL

  # Install required packages for grunt-debian-package
  config.vm.provision "shell", inline: <<-SHELL
    sudo apt-get install -y devscripts debhelper
  SHELL

  # Set NODE_ENV to 'development' by default
  config.vm.provision "shell", inline: <<-SHELL
    echo "export NODE_ENV=development" > /etc/profile.d/node-env.sh
  SHELL

  # Make the contents of github-access-token.secret available as environment variable
  config.vm.provision "shell", run: "always", inline: <<-SHELL
    echo 'export GITHUB_ACCESS_TOKEN=$(cat /vagrant/github-access-token.secret)' > /etc/profile.d/gh-token.sh
  SHELL

  # Share data directory as per XDG Base Directory Specification
  # https://specifications.freedesktop.org/basedir-spec/latest/index.html
  config.vm.synced_folder "data/", "/home/vagrant/.local/share/quartersbrief"
  # Share config directory as per XDG Base Directory Specification
  # https://specifications.freedesktop.org/basedir-spec/latest/index.html
  config.vm.synced_folder "config/", "/home/vagrant/.config/quartersbrief"
  # Share "Fake WoWS" directory to simulate the game actually being installed
  config.vm.synced_folder "wows/", "/opt/World_of_Warships", fsnotify: true

  # cd to the /vagrant directory upon login
  config.ssh.extra_args = ["-t", "cd /vagrant; bash --login"]

  #config.trigger.after :up do |t|
  #  t.name = "vagrant fsnotify"
  #  t.run = { inline: "vagrant fsnotify &" }
  #end
end

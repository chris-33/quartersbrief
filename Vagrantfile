# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/impish64"

  # Expose port 9229 to allow debuggin
  config.vm.network :forwarded_port, guest: 9229, host: 9229

  config.vm.provider "virtualbox" do |vb|
    # Give the vm more memory than the standard 1024 because we will be handling
    # large amounts of data
    # Processing GameParams.data will fail without this
    vb.memory = "2048"
  end

  # Install NodeJS
  config.vm.provision "shell", inline: <<-SHELL
    curl -fsSL https://deb.nodesource.com/setup_17.x | sudo -E bash -
    sudo apt-get install -y nodejs
  SHELL

  # cd to the /vagrant directory upon login
  config.ssh.extra_args = ["-t", "cd /vagrant; bash --login"]
end

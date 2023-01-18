# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  
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

  # Reflect host github user config in vm
  # This is necessary because otherwise using grunt to issue git commands will fail.
  userconfig = `git config -l | grep user`
  config.vm.provision "shell", name: "Configure git user on VM to be the same as on the host", privileged: false, inline: <<-SHELL
    # Read ruby userconfig variable line by line
    while read -r line; do      
      if [[ ! -z $line ]]; then # Skip empty line at EOF
        key=${line%=*} # key is $line, up to the =
        val=${line#*=} # val is $line, after the =
      
        echo "Running command: git config --global --add $key $val"
        git config --global --add "$key" "$val"
      fi
    done < <(echo "#{userconfig}")
  SHELL

  # Install NodeJS
  config.vm.provision "shell", name: "Install Node.JS", inline: <<-SHELL
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
  SHELL

  # Install some development tools
  config.vm.provision "shell", name: "Install development tools", inline: <<-SHELL
      sudo npm install --global grunt-cli 0x
  SHELL

  # act is a tool to run github actions locally for debugging purposes. 
  # It requires docker.
  # Therefore, install docker and configure non-root access. Then install act.
  # Sources: 
  #   https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository
  #   https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user
  #   https://github.com/nektos/act#bash-script
  config.vm.provision "shell", name: "Install act tool to run GitHub actions locally", inline: <<-SHELL
    sudo apt install ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    sudo groupadd docker
    sudo usermod -aG docker vagrant

    cd /usr/local/ && curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
  SHELL

  # Set NODE_ENV to 'development' by default
  # Shut up wine
  config.vm.provision "shell", name: "Set environment variables", inline: <<-SHELL
    echo "export NODE_ENV=development" > /etc/profile.d/node-env.sh
    echo "export WINEDEBUG=-all" > /etc/profile.d/winedebug.sh
  SHELL

  # Make aliases for some common npm run commands. "npm run debug-test" for example can then just be called by typing "debug-test"
  config.vm.provision "shell", name: "Install convenience commands", privileged: false, inline: <<-SHELL
    mkdir -p /home/vagrant/.local/bin
    echo 'npm start -- $@' > /home/vagrant/.local/bin/start  && chmod +x /home/vagrant/.local/bin/start
    ln -s /home/vagrant/.local/bin/start /home/vagrant/.local/bin/quartersbrief
    echo 'npm run debug -- $@' > /home/vagrant/.local/bin/debug  && chmod +x /home/vagrant/.local/bin/debug
    echo 'npm run debug-local -- $@' > /home/vagrant/.local/bin/debug-local  && chmod +x /home/vagrant/.local/bin/debug-local
    # This needs to be "tests" instead of "test" because test is a Linux command
    echo 'npm test -- $@' > /home/vagrant/.local/bin/tests  && chmod +x /home/vagrant/.local/bin/tests
    echo 'npm run debug-test -- $@' > /home/vagrant/.local/bin/debug-test  && chmod +x /home/vagrant/.local/bin/debug-test
    echo 'npm run debug-local-test -- $@' > /home/vagrant/.local/bin/debug-local-test  && chmod +x /home/vagrant/.local/bin/debug-local-test
  SHELL

  # Share directories
  config.vm.synced_folder "dev/vol/data/", "/var/lib/quartersbrief"
  config.vm.synced_folder "dev/vol/config/", "/home/vagrant/.config/quartersbrief"
  config.vm.synced_folder "dev/vol/agendas/", "/usr/share/quartersbrief"
  config.vm.synced_folder "dev/vol/cache/", "/var/cache/quartersbrief"
  # Share "Fake WoWS" directory to simulate the game actually being installed
  config.vm.synced_folder "dev/vol/wows/", "/opt/World_of_Warships", fsnotify: true

  # Use SSH forwarding to allow git to use the host's private key from inside the VM
  config.ssh.forward_agent = true
  # Forward X11
  config.ssh.forward_x11 = true
  # cd to the /vagrant directory upon login
  config.ssh.extra_args = ["-t", "cd /vagrant; bash --login"]

  #config.trigger.after :up do |t|
  #  t.name = "vagrant fsnotify"
  #  t.run = { inline: "vagrant fsnotify &" }
  #end
end

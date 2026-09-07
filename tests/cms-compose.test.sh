#!/usr/bin/env bash

set -euo pipefail

ruby -e '
require "yaml"

base = YAML.load_file("docker-compose.yml")
cms = YAML.load_file("docker-compose.cms.yml")
services = cms.fetch("services")
%w[cms-db directus].each { |name| services.fetch(name) }
%w[cms-db-data cms-uploads].each { |name| cms.fetch("volumes").fetch(name) }

%w[cms-db directus].each do |name|
  service = services.fetch(name)
  abort("#{name} must not expose a host port") if service.key?("ports")
  abort("#{name} must define a health check") unless service.key?("healthcheck")
end

abort("firefly must expose the public port") unless base.fetch("services").fetch("firefly").key?("ports")
'

grep -q 'location ^~ /admin/' nginx.conf
grep -q 'location = /admin' nginx.conf
grep -q 'set \$directus_upstream http://directus:8055;' nginx.conf
grep -q 'location @directus_assets' nginx.conf
grep -q 'location / {' nginx.conf
grep -qx 'CMS_PUBLIC_URL=https://blog.ycocc.com' .env.example
grep -qx '.env.cms' .gitignore

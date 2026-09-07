#!/usr/bin/env bash

set -euo pipefail

ruby -e '
require "yaml"

base = YAML.load_file("docker-compose.yml")
cms = YAML.load_file("docker-compose.cms.yml")
services = cms.fetch("services")
%w[cms-db directus cms-admin-access publisher cms-bootstrap].each { |name| services.fetch(name) }
%w[cms-db-data cms-uploads].each { |name| cms.fetch("volumes").fetch(name) }

%w[cms-db directus].each do |name|
  service = services.fetch(name)
  abort("#{name} must not expose a host port") if service.key?("ports")
  abort("#{name} must define a health check") unless service.key?("healthcheck")
end

admin_access = services.fetch("cms-admin-access")
abort("cms-admin-access must wait for Directus") unless admin_access.fetch("depends_on").dig("directus", "condition") == "service_healthy"
abort("cms-admin-access must complete before cms-bootstrap") unless services.fetch("cms-bootstrap").fetch("depends_on").dig("cms-admin-access", "condition") == "service_completed_successfully"
abort("cms-admin-access must run the policy repair SQL") unless admin_access.fetch("command").join(" ").include?("grant-admin-policy.sql")

abort("firefly must expose the public port") unless base.fetch("services").fetch("firefly").key?("ports")
'

grep -q 'location ^~ /admin/' nginx.conf
grep -q 'location = /admin' nginx.conf
grep -q 'set \$directus_upstream http://directus:8055;' nginx.conf
grep -q 'set \$publisher_upstream http://publisher:8787;' nginx.conf
grep -q 'location \^~ /api/integrations/' nginx.conf
grep -q 'service_completed_successfully' docker-compose.cms.yml
grep -q 'location @directus_assets' nginx.conf
grep -q 'location / {' nginx.conf
grep -qx 'CMS_PUBLIC_URL=https://blog.ycocc.com' .env.example
grep -qx '.env.cms' .gitignore

# arcs-rewrite-webhook
The webhook server for the new BCACTF platform

## Mesoservices:
ARCS is created with a bunch of medium-sized services, each having a specific responsibility.

Event messages often need to be sent to multiple services at once, as in:
- Deploy success to Frontend + Discord + CDN
- Deploy failure to Frontend + Discord
- Deploy metadata to Frontend + SQL
- New solve to SQL
- First blood to Discord

Also, all of the services need access to the database, given that it's the ground truth for the system.

The webhook server exists just so that authentication and sending to multiple targets becomes easier for all other services.

# User roles

| Capability                                      | Unauthenticated | Operator with `publish:false` | Operator with `publish:true` |
| ----------------------------------------------- | --------------- | ----------------------------- | ---------------------------- |
| Read catalog and published timetable            | Yes             | Yes                           | Yes                          |
| Read working draft and verify operator identity | No              | Yes                           | Yes                          |
| Maintain academic records                       | No              | Yes                           | Yes                          |
| Create, edit and validate draft                 | No              | Yes                           | Yes                          |
| Publish current validated revision              | No              | No                            | Yes                          |
| Modify a published version                      | No              | No                            | No                           |

The PL owns publication authority. Provision a named publishing key only to the PL or an explicitly authorized delegate. An optional coordinator can hold a nonpublishing key. That key currently grants all operator writes. There is no coordinator-specific scope or record-level authorization.

Daksh manages operator provisioning, rotation, data access, hosting and migrations. Harry and Priyanshu use synthetic local records and nonpublishing keys for development. Technical maintenance does not confer PL authority.

The API loads a server-side `IMS_OPERATORS` JSON array. It verifies bearer keys and records the configured operator ID on publication. The browser keeps the key in tab session storage until sign-out. There is no account database, SSO, server-side session expiry, or per-user account management. Closing or signing out of a tab does not revoke the underlying key. Revoke or rotate it in server configuration and restart the API.

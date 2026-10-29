/**
 * Host half of `dsh-why-reject`.
 *
 * The capability is entirely browser-side: the Client module takes over the
 * approval composer while a permission request is pending and sends the user's
 * rejection reason through the public Session prompt RPC. This empty Host
 * plugin keeps the bundle installable as one ordinary Loader row and has no
 * Host-side side effects to clean up.
 */
export function apply() {}

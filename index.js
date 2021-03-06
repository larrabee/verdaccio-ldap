var crypto = require('crypto');
var assert = require('assert');
var LdapAuth = require('ldapauth-fork');
var parseDN = require('ldapjs').parseDN;

function Auth(config, stuff) {
  var self = Object.create(Auth.prototype);
  self._users = {};

  // config for this module
  self._config = config;

  // verdaccio logger
  self._logger = stuff.logger;

  // pass verdaccio logger to ldapauth
  self._config.client_options.log = stuff.logger;

  // TODO: Set more defaults
  self._config.groupNameAttribute = self._config.groupNameAttribute || 'cn';

  return self;
}

module.exports = Auth;

//
// Attempt to authenticate user against LDAP backend
//
Auth.prototype.authenticate = function (user, password, callback) {
  var self = this;
  var LdapClient = new LdapAuth(self._config.client_options);

  LdapClient.authenticate(user, password, function (err, ldapUser) {
    if (err) {
      // 'No such user' is reported via error
      self._logger.warn({
        user: user,
        err: err,
      }, 'LDAP error @{err}');

      LdapClient.close(function (err) {
        if (err) {
          self._logger.warn({
            err: err
          }, 'LDAP error on close @{err}');
        }
      });

      return callback(null, false);
    }

    var groups;
    if (ldapUser) {
      groups = [user];
      if ('memberOf' in ldapUser) {
        if (!Array.isArray(ldapUser.memberOf)) {
          ldapUser.memberOf = [ldapUser.memberOf];
        }
        for (var i = 0; i < ldapUser.memberOf.length; i++) {
          if (Object.keys(parseDN(ldapUser.memberOf[i]).rdns[0].attrs).indexOf(self._config.groupNameAttribute) > -1) {
            groups.push(parseDN(ldapUser.memberOf[i]).rdns[0].attrs[self._config.groupNameAttribute].value);
          }
        }
      }
    }

    callback(null, groups);

    LdapClient.close(function (err) {
      if (err) {
        self._logger.warn({
          err: err
        }, 'LDAP error on close @{err}');
      }
    });

  });
};

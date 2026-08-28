(function () {
  var hash = window.location.hash || "";
  var search = window.location.search || "";
  var isRecovery =
    hash.indexOf("type=recovery") !== -1 ||
    search.indexOf("type=recovery") !== -1 ||
    search.indexOf("nueva-password") !== -1 ||
    search.indexOf("recovery") !== -1;
  var origin = window.location.origin;
  var fallback = isRecovery
    ? origin + "/recuperar-password?error=enlace_invalido"
    : origin + "/login?reason=email_confirmation&error=enlace_invalido";

  if (
    hash.indexOf("access_token=") !== -1 ||
    hash.indexOf("refresh_token=") !== -1 ||
    hash.indexOf("code=") !== -1
  ) {
    var target = isRecovery ? origin + "/nueva-password" : origin + "/onboarding?nuevo=1";
    window.location.replace(target + hash);
  } else {
    window.location.replace(fallback);
  }
})();

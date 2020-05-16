export const splitNameTarget = (pkgNameTarget) => {
  const [
    __,
    pkgName,
    pkgTarget,
  ] = /((?:@[^\/]*\/[^\/]*)|(?:^[^@][^\/][^\/]*))\/(.*)/.exec(
    pkgNameTarget
  ) ?? [null, pkgNameTarget, null];
  return { pkgName, pkgTarget };
};

export const formatPkgCommand = (str) => {
  const [_, pkgNameTarget, pkgVersion] =
    !str.includes("@") || (str.startsWith("@") && str.match(/@/g).length === 1)
      ? [null, str, null]
      : /(.*)@(.*)/.exec(str);
  const { pkgName, pkgTarget } = splitNameTarget(pkgNameTarget);
  return {
    pkgNameTarget,
    pkgName,
    pkgTarget,
    pkgVersion,
  };
};

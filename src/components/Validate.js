export default class Validate {
    static isUrlValid(url) {
        // var regexQuery = "^(https?://)?(www\\.)?([-a-z0-9]{1,63}\\.)*?[a-z0-9][-a-z0-9]{0,61}[a-z0-9]\\.[a-z]{2,6}(/[-\\w@\\+\\.~#\\?&/=%]*)?$";
        // var checkurl = new RegExp(regexQuery, "i")
        const regex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/g;
        return regex.test(url)
    }
}
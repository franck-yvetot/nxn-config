const fs = require('fs');
let debug= console;
const yaml = require('js-yaml');

/**
 * 
 *  read a json or yaml config file from defined paths
 * 
 * */ 
class configSce 
{
    constructor() {
        this.app = null;
        this.config = {};
        this.dirPaths = [];
    }

    init(dirPaths) {
        this.dirPaths = dirPaths;
    }

    existsConfig(path) {
        try {
            if (fs.existsSync(path))
                return true;
            else
                return false;
          } 
          catch(err) {
            return false;
        }
    }
 

    loadConfig(path,dirPaths) {
        var self = this;

        dirPaths =  dirPaths || this.dirPaths;
        let content = null;
        let config = null;
        let foundPath = path;
        const exts = ['','.json','.yml','.yaml'];

        // Read file
        if(dirPaths)
        {
            dirPaths.forEach(dir => {
                exts.forEach(ext=> {
                    const p = dir+path+ext;
                    if(!content && self.existsConfig(p)) {
                        content = fs.readFileSync(p);
                        foundPath = p;
                    }                
                });
            });

            if(!this.dirPaths)
                this.dirPaths = dirPaths;
        }
        
        if(!content)
            content = fs.readFileSync(path);
        
        if(!content)
            debug.log('boot with no config');        

        if(foundPath.endsWith("yaml") || foundPath.endsWith("yml"))
        {
            debug.log('YAML boot config : '+foundPath);
            config = yaml.safeLoad(content);
        }
        else {
            debug.log('JSON boot config : '+foundPath);
            config = JSON.parse(content);
        }

        return config;
    }
}

module.exports = new configSce();
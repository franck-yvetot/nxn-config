const fs = require('fs');
let debug= console;
const yaml = require('js-yaml');
const mapper = require("./variables.service");

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
        this.env = '';
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
 
    mapVariables(config,variables) {
        return mapper.mapConfig(config,variables);
    }

    loadVariables(path,dirPaths,env='') {
        this.variables = this.loadConfig(path,dirPaths);
    }

    applyVariables(config,variables,path) {
       
        if(variables)
        {
            config = this.mapVariables(config,variables);

            if(false && path)
                fs.writeFile(path+'_parsed.yml',yaml.safeDump(config),(err) => {
                    if (err) {
                        console.log(err);
                    }
                });
        }

        return config;
    }

    loadConfig(path,dirPaths,variables=null) {
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

        if(variables)
        {
            config = this.mapVariables(config,variables);  
            fs.writeFile(foundPath+'_parsed.yml',yaml.safeDump(config),(err) => {
                if (err) {
                    console.log(err);
                }
            });
        }

        return config;
    }
}

module.exports = new configSce();
const course={...require('./curriculum.cjs'),patterns:require('./patterns.cjs'),designs:require('./designs.cjs')};
require('./advanced.cjs')(course);
require('./specialized.cjs')(course);
require('./walkthroughs.cjs')(course);
require('./architectures.cjs')(course);
course.labs=require('./labs/catalog.cjs');
module.exports=course;

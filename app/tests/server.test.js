const expect        = require('expect');
const request       = require('supertest');
const {app}         = require('../');
const {ObjectID}    = require('mongodb');
const {Todo}        = require('./../models/todo');
const {User}        = require('./../models/user');

const {dummyTodos, populateTodos, dummyUsers, populateUsers} = require('./seed/seed');


// make the DB empty first
beforeEach(populateUsers);
beforeEach(populateTodos);

// write tests 
describe ('GET /todos', () => {
    it('should get all todos', (done) => {

        request(app)
        .get('/todos')
        .set('x-auth', dummyUsers[0].tokens[0].token)
        .expect(200)
        .expect((res) => {
            expect(res.body.data.length).toBe(2);
        })
        .end(done)
    });
});

describe ('POST /todos', () => {

    it('should create a new todo', (done) => {
        let text = 'make a test suit';

        request(app)
        .post('/todos')
        .set('x-auth', dummyUsers[0].tokens[0].token)
        .send({text})
        .expect(201)
        .expect((res) => {
            expect(res.body.text).toBe(text);
        }).end((err, res) => {
            if (err) {
                return done(err);
            }
            done();
        });
    });

    it ('should not create a todo for invalid data', (done) => {

        request(app)
        .post('/todos')
        .set('x-auth', dummyUsers[0].tokens[0].token)        
        .send({})
        .expect(500)
        .end((err, res) => {
            if(err) {
                return done(err);
            }

            Todo.find().then((todos) => {
                expect(todos.length).toBe(3);
                done();
            }).catch((err) => done(err));
        });
    });

});


describe ('GET /todos/:id', () => {
    it('should return a todo doc', (done) => {
        request(app)
        .get(`/todos/${dummyTodos[0]._id.toHexString()}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)        
        .expect(200)
        .expect((res) => {
            expect(res.body.todo.text).toBe(dummyTodos[0].text);
        })
        .end(done);
    });

    it('should not return a todo doc created by othe user', (done) => {
        request(app)
        .get(`/todos/${dummyTodos[2]._id.toHexString()}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)        
        .expect(404)
        .end(done);
    });

    it('should give a 404 if id not found', (done) => {
        //create a new id for testing 
        let hexID = new ObjectID();
        request(app)
        .get('/todos/' + hexID)
        .set('x-auth', dummyUsers[0].tokens[0].token)        
        .expect(404)
        .end(done);
    });

    it('should return a 422 if todo id is invalid', (done) => {
        request(app)
        .get(`/todos/${dummyTodos[0]._id.toHexString() + '21ab'}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)        
        .expect(422)
        .end(done);
    });
});

describe('DELETE /todos/:id', () => {

    let hexID = new ObjectID();    

    it('should delete a todo for a valid id', (done) => {
        let todoHexID = dummyTodos[0]._id.toHexString();

        request(app)
        .delete(`/todos/${todoHexID}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)
        .expect(200)
        .expect((res) => {
            expect(res.body.todo._id).toBe(todoHexID);
            expect(res.body.status).toBe(200);
        })
        .end((err, res) => {
            if(err) {
                return done(err);
            }

            Todo.findById(todoHexID).then((todo) => {
                expect(todo).toNotExist();
                done();
            }).catch((err) => done(err));
        });
    });
    
    it('should not delete a todo created by other user', (done) => {
        let todoHexID = dummyTodos[2]._id.toHexString();

        request(app)
        .delete(`/todos/${todoHexID}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)
        .expect(404)
        .end((err, res) => {
            if(err) {
                return done(err);
            }

            Todo.findById(todoHexID).then((todo) => {
                expect(todo).toExist();
                done();
            }).catch((err) => done(err));
        });
    });

    it('should give 400 for invalid id', (done) => {
        request(app)
        .delete(`/todos/${hexID.toHexString() + '45'}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)        
        .expect(400)
        .expect((res) => {
            expect(res.body.status).toBe(400);
        })
        .end(done);
    });

    it('should give 404 if todo not found', (done) => {
        request(app)
        .delete(`/todos/${hexID.toHexString()}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)        
        .expect(404)
        .expect((res) => {
            expect(res.body.status).toBe(404);
        })
        .end(done);
    });
});

describe('PATCH /todos/:id', () => {

    it('should set completed of a todo as true', (done) => {
        let hexID = dummyTodos[0]._id.toHexString();
        let text = 'This should be the new text';

        request(app)
        .patch(`/todos/${hexID}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)
        .send({
            text,
            completed : true
        })
        .expect(200)
        .expect((res) => {
            expect(res.body.todo.text).toBe(text);
            expect(res.body.todo.completed).toBe(true);
            expect(res.body.todo.completedAt).toBeA('number');
        })
        .end(done); 
    }); 

    it('should not set completed of a todo as true for other user', (done) => {
        let hexID = dummyTodos[2]._id.toHexString();
        let text = 'This should be the new text';

        request(app)
        .patch(`/todos/${hexID}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)
        .send({
            text,
            completed : true
        })
        .expect(404)
        .end(done); 
    }); 

    it('should clear completed when todo edited/renamed', (done) => {
        let hexID = dummyTodos[1]._id.toHexString();
        text = 'Renamed to a new task';

        request(app)
        .patch(`/todos/${hexID}`)
        .set('x-auth', dummyUsers[0].tokens[0].token)
        .send({
            completed : false,
            completedAt : null,
            text
        })
        .expect(200)
        .expect((res) => {
            expect(res.body.todo.completed).toBe(false);
            expect(res.body.todo.text).toBe(text);
            expect(res.body.todo.completedAt).toNotExist();
            
        })
        .end(done);

    });

});

describe('GET /users/me', () => {

    it('should return a user for valid token', (done) => {
        request(app)
        .get('/users/me')
        .set('x-auth', dummyUsers[0].tokens[0].token)
        .expect(200)
        .expect((res) => {
            //console.log('**Response', res.body);
            expect(res.body.user._id).toBe(dummyUsers[0]._id.toHexString());
            expect(res.body.user.email).toBe(dummyUsers[0].email);
        }).end(done);
    });

    it('should give 401 for invalid token', (done) => {
        let value = undefined;
        request(app)
        .get('/users/me')
        .expect(401)
        .expect((res) => {
            expect(res.body.status).toBe(401)
        }).end(done);        
    }); 
});

describe('POST /users', () => {
    it('should create a user with valid email and name', (done) => {
        let name = 'example';
        let email = 'ex@mail.co';
        let password = 'example@pass';

        request(app)
        .post('/users')
        .send({name, email, password})
        .expect(200)
        .expect((res) => {
            expect(res.body.user.email).toBe(email);
            expect(res.body.user._id).toExist();
            expect(res.headers['x-auth']).toExist();
        }).end((err) => {
            if (err) {
                return done();
            }
            User.findOne({email}).then((user) => {
                expect(user).toExist();
                expect(user.email).toBe(email);
                expect(user.password).toNotBe(password);
                done();
            }).catch((err) => done(err));
        });
    });

    it('should give validation error for invalid data', (done) => {
        let email = 'error';
        let password = 'abc';
        
        request(app)
        .post('/users')
        .send({})
        .expect(400)
        .end(done);
    });

    it('should give a 400 for duplicate email', (done) => {
        request(app)
        .post('/users')
        .send(dummyUsers[0])
        .expect(400)
        .end(done);
    });
});

describe('POST /users/login', () => {

    it('should return a token and user for valid login', (done) => {
        
        request(app)
        .post('/users/login')
        .send({
            email : dummyUsers[1].email,
            password : dummyUsers[1].password
        })
        .expect(200)
        .expect((res) => {
            //console.log('**Res Body => ', res.body);
            expect(res.headers['x-auth']).toExist();
            expect(res.body.user.email).toBe(dummyUsers[1].email);
        }).end((err, res) => {
            if(err) {
                return done(err);
            }

            User.findById(dummyUsers[1]._id).then((user) => {
                expect(user.tokens[1]).toInclude({
                    access : 'auth',
                    token : res.headers['x-auth']
                });
                done();
            }).catch((err) => done(err));
        });
    });

    it('should return 500 for invalid email and password', (done) => {
        
        request(app)
        .post('/users/login')
        .send({
            email : dummyUsers[1].email,
            password : dummyUsers[1].password + 'abc'
        })
        .expect(500)
        .expect((res) => {
            expect(res.headers['x-auth']).toNotExist();
        }).end((err, res) => {
            if(err) {
                return done(err);
            }

            User.findById(dummyUsers[1]._id).then((user) => {
                expect(user.tokens.length).toBe(1);
                done();
            }).catch((err) => done(err));
        });
    });
});

describe('DELETE /users/logout', () => {
    it('should remove the valid token on logout', (done) => {

        request(app)
        .delete('/users/logout')
        .set('x-auth', dummyUsers[0].tokens[0].token)
        .expect(204)
        .end((err, res) => {
            if(err) {
                return done(err);
            }

            User.findById(dummyUsers[0]._id).then((user) => {
                expect(user.tokens.length).toBe(0);
                done();
            }).catch((err) => done(err));
        });
    });
});
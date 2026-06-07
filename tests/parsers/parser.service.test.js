const parserService = require('../../src/services/parser.service');

describe('parserService', () => {
    test('parses supported Express route calls with line numbers', () => {
        const content = [
            'const router = require("express").Router();',
            'router.get("/users", listUsers);',
            'router.post("/createUser", createUser);',
            'app.delete("/users/:id", deleteUser);',
        ].join('\n');

        const result = parserService.parseContent({
            content,
            sourceFile: 'src/routes/user.routes.js',
        });

        expect(result.fileType).toBe('express');
        expect(result.endpointCount).toBe(3);
        expect(result.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toEqual([
            'GET /users',
            'POST /createUser',
            'DELETE /users/:id',
        ]);
        expect(result.endpoints[0].lineNumber).toBe(2);
    });

    test('parses OpenAPI JSON paths', () => {
        const content = JSON.stringify({
            openapi: '3.0.0',
            paths: {
                '/users': {
                    get: {
                        summary: 'List users',
                        responses: {
                            200: {
                                description: 'OK',
                            },
                        },
                    },
                    post: {
                        responses: {
                            201: {
                                description: 'Created',
                            },
                        },
                    },
                },
            },
        });

        const result = parserService.parseContent({
            content,
            sourceFile: 'openapi.json',
        });

        expect(result.fileType).toBe('openapi');
        expect(result.endpointCount).toBe(2);
        expect(result.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toEqual([
            'GET /users',
            'POST /users',
        ]);
    });

    test('parses Express router.route chains', () => {
        const content = [
            'const router = require("express").Router();',
            'router.route("/users")',
            '  .get(listUsers)',
            '  .post(createUser);',
        ].join('\n');

        const result = parserService.parseContent({
            content,
            sourceFile: 'src/routes/user.routes.js',
        });

        expect(result.endpointCount).toBe(2);
        expect(result.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toEqual([
            'GET /users',
            'POST /users',
        ]);
    });

    test('applies app.use and router.use mount prefixes in the same file', () => {
        const content = [
            'const app = require("express")();',
            'const router = require("express").Router();',
            'const adminRouter = require("express").Router();',
            'app.use("/api/v1", router);',
            'router.use("/admin", adminRouter);',
            'router.get("/users", listUsers);',
            'adminRouter.delete("/users/:id", deleteUser);',
        ].join('\n');

        const result = parserService.parseContent({
            content,
            sourceFile: 'src/routes/user.routes.js',
        });

        expect(result.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).toEqual([
            'GET /api/v1/users',
            'DELETE /api/v1/admin/users/:id',
        ]);
    });

    test('parses Postman Collection requests', () => {
        const content = JSON.stringify({
            info: {
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
            },
            item: [
                {
                    name: 'List users',
                    request: {
                        method: 'GET',
                        url: {
                            raw: 'http://localhost:5000/users?page=1',
                            path: ['users'],
                            query: [
                                {
                                    key: 'page',
                                    value: '1',
                                },
                            ],
                        },
                    },
                },
            ],
        });

        const result = parserService.parseContent({
            content,
            sourceFile: 'collection.json',
        });

        expect(result.fileType).toBe('postman');
        expect(result.endpointCount).toBe(1);
        expect(result.endpoints[0].method).toBe('GET');
        expect(result.endpoints[0].path).toBe('/users');
        expect(result.endpoints[0].parameters).toHaveLength(1);
    });
});

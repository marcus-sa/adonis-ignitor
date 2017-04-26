'use strict'

/*
 * adonis-ignitor
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const path = require('path')
const test = require('japa')
const clearRequire = require('clear-require')
const fold = require('adonis-fold')
const hooks = require('../src/Hooks')
const Ignitor = require('../src/Ignitor')

test.group('Ignitor', (group) => {
  group.beforeEach(() => {
    hooks.before.clear()
    hooks.after.clear()
    fold.ioc._autoloads = {}
    clearRequire(path.join(__dirname, 'start/app.js'))
  })

  test('register app root', (assert) => {
    const ignitor = new Ignitor()
    ignitor.appRoot('foo')
    assert.equal(ignitor._appRoot, 'foo')
  })

  test('default app file to start/app.js', (assert) => {
    const ignitor = new Ignitor()
    assert.equal(ignitor._appFile, 'start/app.js')
  })

  test('register app file', (assert) => {
    const ignitor = new Ignitor()
    ignitor.appFile('start/app.js')
    assert.equal(ignitor._appFile, 'start/app.js')
  })

  test('add file to preloaded list', (assert) => {
    const ignitor = new Ignitor()
    ignitor.preLoad('start/foo.js')
    assert.include(ignitor._preLoadFiles, 'start/foo.js')
  })

  test('add file after given file in preload list', (assert) => {
    const ignitor = new Ignitor()
    ignitor.preLoadAfter('start/routes', 'start/foo.js')
    assert.equal(ignitor._preLoadFiles[1], 'start/foo.js')
  })

  test('append to the end when matching file not found', (assert) => {
    const ignitor = new Ignitor()
    ignitor.preLoadAfter('start/ooo', 'start/foo.js')
    assert.equal(ignitor._preLoadFiles[ignitor._preLoadFiles.length - 1], 'start/foo.js')
  })

  test('recognize when matching files have/missing extensions', (assert) => {
    const ignitor = new Ignitor()
    ignitor.preLoadAfter('start/routes.js', 'start/foo.js')
    assert.equal(ignitor._preLoadFiles[1], 'start/foo.js')
  })

  test('append before a given file', (assert) => {
    const ignitor = new Ignitor()
    ignitor.preLoadBefore('start/events', 'start/foo.js')
    assert.equal(ignitor._preLoadFiles[1], 'start/foo.js')
  })

  test('throw exception when trying to fire without app root', async (assert) => {
    assert.plan(1)
    const ignitor = new Ignitor()
    try {
      await ignitor.fireHttpServer()
    } catch ({ message }) {
      assert.equal(message, 'Cannot start http server, make sure to register the app root inside server.js file')
    }
  })

  test('register providers by requiring the app file', (assert) => {
    const ignitor = new Ignitor(fold)
    ignitor.appRoot(path.join(__dirname, './'))
    ignitor._preLoadFiles = []
    ignitor._startHttpServer = function () {}
    ignitor.fireHttpServer()
  })

  test('emit before and after registered provider events', (assert) => {
    const ignitor = new Ignitor(fold)
    const events = []
    hooks.before.providersRegistered(() => {
      events.push('before')
    })
    hooks.after.providersRegistered(() => {
      events.push('after')
    })
    ignitor.appRoot(path.join(__dirname, './'))
    ignitor._preLoadFiles = []
    ignitor._startHttpServer = function () {}
    ignitor.fireHttpServer()
    assert.deepEqual(events, ['before', 'after'])
  })

  test('emit multiple hooks in sequence', (assert) => {
    const ignitor = new Ignitor(fold)
    const events = []
    hooks
      .before
      .providersRegistered(() => {
        events.push('before')
      })
      .providersRegistered(() => {
        events.push('before 1')
      })

    hooks
      .after
      .providersRegistered(() => {
        events.push('after')
      })
      .providersRegistered(() => {
        events.push('after 1')
      })

    ignitor.appRoot(path.join(__dirname, './'))
    ignitor._preLoadFiles = []
    ignitor._startHttpServer = function () {}
    ignitor.fireHttpServer()
    assert.deepEqual(events, ['before', 'before 1', 'after', 'after 1'])
  })

  test('boot providers after registering them', async (assert) => {
    const ignitor = new Ignitor(fold)
    ignitor.appRoot(path.join(__dirname, './'))
    ignitor._preLoadFiles = []
    ignitor._startHttpServer = function () {}
    await ignitor.fireHttpServer()
    assert.deepEqual(fold.registrar._providers[0]._events, ['register', 'boot'])
  })

  test('wait until providers have been booted', async (assert) => {
    const ignitor = new Ignitor(fold)
    ignitor.appRoot(path.join(__dirname, './'))
    const appFile = require(path.join(__dirname, ignitor._appFile))
    appFile.providers = [
      path.join(__dirname, './providers/SlowProvider')
    ]
    ignitor._preLoadFiles = []
    ignitor._startHttpServer = function () {}
    await ignitor.fireHttpServer()
    assert.deepEqual(fold.registrar._providers[0]._events, ['register', 'boot'])
  })

  test('emit booted events in right order', async (assert) => {
    const ignitor = new Ignitor(fold)
    const events = []
    hooks
      .before
      .providersRegistered(() => events.push('before registered'))
      .providersBooted(() => events.push('before booted'))

    hooks
      .after
      .providersRegistered(() => events.push('after registered'))
      .providersBooted(() => events.push('after booted'))

    ignitor.appRoot(path.join(__dirname, './'))
    ignitor._preLoadFiles = []
    ignitor._startHttpServer = function () {}
    await ignitor.fireHttpServer()
    assert.deepEqual(events, ['before registered', 'after registered', 'before booted', 'after booted'])
  })

  test('register aliases for providers when defined', async (assert) => {
    const ignitor = new Ignitor(fold)
    ignitor.appRoot(path.join(__dirname, './'))
    const appFile = require(path.join(__dirname, ignitor._appFile))

    appFile.aliases = {
      Route: 'Adonis/Src/Route',
      Server: 'Adonis/Src/Server'
    }

    ignitor._preLoadFiles = []
    ignitor._startHttpServer = function () {}
    await ignitor.fireHttpServer()
    assert.deepEqual(fold.ioc._aliases, appFile.aliases)
  })

  test('load files to be preloaded', async (assert) => {
    const ignitor = new Ignitor(fold)
    ignitor.appRoot(path.join(__dirname, './'))
    ignitor._preLoadFiles = ['start/routes', 'start/events']
    ignitor._startHttpServer = function () {}
    await ignitor.fireHttpServer()
  })

  test('call preloading hooks', async (assert) => {
    const ignitor = new Ignitor(fold)
    const events = []
    hooks
      .before.preloading(() => events.push('before preloading'))

    hooks.after.preloading(() => events.push('after preloading'))

    ignitor.appRoot(path.join(__dirname, './'))
    ignitor._preLoadFiles = []
    ignitor._startHttpServer = function () {}
    await ignitor.fireHttpServer()
    assert.deepEqual(events, ['before preloading', 'after preloading'])
  })

  test('load ace providers when fireAce command is called', async (assert) => {
    assert.plan(1)
    const ignitor = new Ignitor(fold)
    ignitor.appRoot(path.join(__dirname, './'))
    ignitor._preLoadFiles = []
    const appFile = require(path.join(__dirname, ignitor._appFile))
    appFile.aceProviders = ['Adonis/Src/Command']
    try {
      await ignitor.fireAce()
    } catch ({ message }) {
      assert.equal(message, `Cannot find module 'Adonis/Src/Command'`)
    }
  })

  test('setup resolver', async (assert) => {
    const ignitor = new Ignitor(fold)
    ignitor.appRoot(path.join(__dirname, './'))
    ignitor._preLoadFiles = []
    await ignitor.fire()
    assert.property(fold.resolver._directories, 'httpControllers')
    assert.property(fold.resolver._directories, 'models')
    assert.deepEqual(fold.ioc._autoloads, { 'App': './app' })
  })

  test('setup default namespace when autoload key is defined but values are missing', async (assert) => {
    const ignitor = new Ignitor(fold)
    ignitor.appRoot(path.join(__dirname, './'))
    const pkgFile = require(path.join(__dirname, './package.json'))
    pkgFile.autoload = {}
    ignitor._preLoadFiles = []
    await ignitor.fire()
    assert.deepEqual(fold.ioc._autoloads, { 'App': './app' })
  })

  test('use package file autoload values when defined', async (assert) => {
    const ignitor = new Ignitor(fold)
    ignitor.appRoot(path.join(__dirname, './'))
    const pkgFile = require(path.join(__dirname, './package.json'))
    pkgFile.autoload = {
      'MyApp': './app'
    }
    ignitor._preLoadFiles = []
    await ignitor.fire()
    assert.deepEqual(fold.ioc._autoloads, { 'MyApp': './app' })
  })
})

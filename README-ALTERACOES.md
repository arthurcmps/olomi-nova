# Olomi — códigos finais revisados

Arquivos revisados:

- `functions/index.js`
- `firestore.rules`
- `storage.rules`
- `public/js/utils.js`
- `public/js/catalogo.js`
- `public/js/carrinho.js`
- `public/js/main.js`
- `public/css/style.css`

## Secrets obrigatórios

Antes do deploy:

```bash
firebase functions:secrets:set MERCADOPAGO_ACCESS_TOKEN
firebase functions:secrets:set SUPERFRETE_TOKEN
```

Não coloque os tokens novamente em arquivos JavaScript.

## Deploy

```bash
firebase deploy --only functions,firestore:rules,storage
firebase deploy --only hosting
```

## Observação

O frontend continua usando a Public Key do Mercado Pago. O Access Token permanece apenas no backend via Secret Manager.

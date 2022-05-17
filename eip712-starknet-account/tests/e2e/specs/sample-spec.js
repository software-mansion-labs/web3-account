describe('wallet tests', () => {
  it('Onboarding flow', () => {
    cy.visit('/');

    cy.get('#connectMetamaskButton').click();

    cy.acceptMetamaskAccess(true);

    cy.contains('Create my account');

    cy.get('form button').click();

    cy.contains('Token wallet', { timeout: 30000 });
  });
});

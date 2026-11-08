import { test, expect } from '@playwright/test'

test('home shows work title and three parts', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '奈奈与薰的SM日记' })).toBeVisible()
  await expect(page.getByText('本篇')).toBeVisible()
  await expect(page.getByText('夏日篇')).toBeVisible()
  await expect(page.getByText('高校篇')).toBeVisible()
  await page.getByRole('link', { name: /从本篇开始读/ }).click()
  await expect(page).toHaveURL(/\/part\/main/)
})

test('main dual gallery route', async ({ page }) => {
  await page.goto('/part/main')
  await page.getByRole('link', { name: /双页图/ }).click()
  await expect(page).toHaveURL(/\/gallery\/dual/)
  await expect(page.getByText(/双页/)).toBeVisible()
})

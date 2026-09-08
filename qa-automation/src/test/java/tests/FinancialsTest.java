package tests;

import base.BaseTest;
import org.testng.Assert;
import org.testng.annotations.Test;
import pages.FinancialsPage;

public class FinancialsTest extends BaseTest {

    @Test(
        groups = {"regression"},
        description = "Verify financial dashboard content"
    )
    public void verifyFinancialDashboard() {

        FinancialsPage financials =
                new FinancialsPage(driver);

        financials.open();

        Assert.assertTrue(
                financials.pageContainsFinancialContent(),
                "Financial content should be displayed"
        );

        Assert.assertTrue(
                financials.hasLinks(),
                "Financial page should contain navigation links"
        );
    }
}
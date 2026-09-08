package tests;

import base.BaseTest;
import org.testng.Assert;
import org.testng.annotations.Test;
import pages.DashboardPage;

public class DashboardTest extends BaseTest {

    @Test(
        groups = {"smoke", "regression"},
        description = "Verify that the banking dashboard loads successfully"
    )
    public void verifyDashboardLoads() {

        DashboardPage dashboard =
                new DashboardPage(driver);

        dashboard.open();

        Assert.assertTrue(
                dashboard.isLoaded(),
                "Dashboard heading should be visible"
        );
    }
}